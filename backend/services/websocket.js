const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const CallSession = require('../models/CallSession');
const AgentStatus = require('../models/AgentStatus');

class WebSocketService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // userId -> socketId mapping
    this.socketToUser = new Map(); // socketId -> userId mapping
  }

  initialize(server) {
    this.io = socketIo(server, {
      cors: {
        origin: function(origin, callback) {
          const allowedOrigins = [
            'http://localhost:3000',
            'http://localhost:3001',
            'http://localhost:3002',
            process.env.FRONTEND_URL
          ].filter(Boolean);
          
          // Allow requests with no origin (like mobile apps or curl requests)
          if (!origin) return callback(null, true);
          
          callback(null, true); // 開発環境では全て許可
        },
        methods: ['GET', 'POST'],
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization']
      },
      transports: ['websocket', 'polling'] // 明示的にトランスポートを指定
    });

    // グローバルに io インスタンスを設定
    global.io = this.io;

    // 認証ミドルウェア (開発環境ではオプショナル)
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        
        // 開発環境では認証をスキップ
        if (process.env.NODE_ENV === 'development' && !token) {
          socket.userId = 'dev-user-' + Math.random().toString(36).substr(2, 9);
          socket.user = { _id: socket.userId, role: 'admin' };
          return next();
        }

        if (!token) {
          return next(new Error('Authentication error'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');
        
        if (!user) {
          return next(new Error('User not found'));
        }

        socket.userId = user._id.toString();
        socket.user = user;
        next();
      } catch (error) {
        // 開発環境ではエラーでも接続を許可
        if (process.env.NODE_ENV === 'development') {
          socket.userId = 'dev-user-' + Math.random().toString(36).substr(2, 9);
          socket.user = { _id: socket.userId, role: 'admin' };
          return next();
        }
        next(new Error('Authentication error'));
      }
    });

    // 接続イベント
    this.io.on('connection', (socket) => {
      console.log('========== New Socket Connection ==========');
      console.log(`[WebSocket] User ${socket.userId} connected`);
      console.log(`[WebSocket] Socket ID: ${socket.id}`);
      console.log('[WebSocket] 総接続ユーザー数:', this.connectedUsers.size + 1);
      console.log('==========================================');
      this.handleConnection(socket);

      // イベントリスナーの設定
      this.setupEventListeners(socket);

      // 切断イベント
      socket.on('disconnect', () => {
        console.log('========== Socket disconnect ==========');
        console.log(`[WebSocket] User ${socket.userId} disconnected`);
        console.log(`[WebSocket] Socket ID: ${socket.id}`);
        console.log('[WebSocket] 残りの接続ユーザー数:', this.connectedUsers.size - 1);
        console.log('=======================================');
        this.handleDisconnection(socket);
      });
      
      // 通話ルームから退出
      socket.on('leave-call', (data) => {
        const { phoneNumber } = data;
        if (phoneNumber) {
          const roomName = `call-${phoneNumber}`;
          socket.leave(roomName);
          console.log(`[WebSocket] Socket ${socket.id} が room '${roomName}' から退出しました`);
        }
      });
    });

    return this.io;
  }

  handleConnection(socket) {
    // ユーザーとソケットのマッピングを保存
    this.connectedUsers.set(socket.userId, socket.id);
    this.socketToUser.set(socket.id, socket.userId);

    // エージェントステータスを更新
    this.updateAgentOnlineStatus(socket.userId, true);

    // 接続したユーザーに現在のアクティブコールを送信
    this.sendActiveCalls(socket);
  }

  handleDisconnection(socket) {
    // マッピングを削除
    this.connectedUsers.delete(socket.userId);
    this.socketToUser.delete(socket.id);

    // エージェントステータスを更新
    this.updateAgentOnlineStatus(socket.userId, false);
  }

  setupEventListeners(socket) {
    console.log(`[WebSocket] Setting up event listeners for socket ${socket.id}`);
    
    // 通話ルームに参加（CallStatusModalから）
    socket.on('join-call', (data) => {
      console.log('========== join-call イベント受信 ==========');
      console.log('[WebSocket] Socket ID:', socket.id);
      console.log('[WebSocket] Data:', data);
      const { phoneNumber } = data;
      console.log('[WebSocket] 電話番号:', phoneNumber);
      
      if (phoneNumber) {
        const roomName = `call-${phoneNumber}`;
        socket.join(roomName);
        console.log(`[WebSocket] Socket ${socket.id} が room '${roomName}' に参加しました`);
        
        // 参加確認メッセージを送信
        socket.emit('joined-call-room', {
          phoneNumber,
          roomName,
          socketId: socket.id
        });
      } else {
        console.error('[WebSocket] ERROR: phoneNumber is missing');
      }
      console.log('===========================================');
    });
    
    // 通話モニタリング開始
    socket.on('monitor-call', async (callId) => {
      const call = await CallSession.findById(callId);
      if (call) {
        socket.join(`call-${callId}`);
        socket.emit('call-details', call);
      }
    });

    // 通話モニタリング停止
    socket.on('stop-monitor-call', (callId) => {
      socket.leave(`call-${callId}`);
    });

    // エージェントステータス更新
    socket.on('update-agent-status', async (status) => {
      await this.updateAgentStatus(socket.userId, status);
      this.broadcastAgentStatus(socket.userId, status);
    });
    
    // 通話状況取得リクエスト
    socket.on('get-call-status', async (data) => {
      console.log('[WebSocket] get-call-statusリクエスト:', data);
      try {
        const { phoneNumber } = data;
        const normalizedPhone = phoneNumber?.startsWith('+81') 
          ? '0' + phoneNumber.substring(3) 
          : phoneNumber;
        
        // 電話番号からアクティブな通話を検索
        const activeCall = await CallSession.findOne({
          phoneNumber: { $in: [phoneNumber, normalizedPhone] },
          status: { $in: ['calling', 'initiated', 'ai-responding', 'in-progress', 'human-connected', 'transferring'] }
        }).sort({ createdAt: -1 });
        
        if (activeCall) {
          socket.emit('call-status', {
            phoneNumber: normalizedPhone,
            status: activeCall.status,
            callSid: activeCall.twilioCallSid,
            callId: activeCall._id.toString()
          });
        }
      } catch (error) {
        console.error('[WebSocket] Error getting call status:', error);
      }
    });
    
    // トランスクリプト取得リクエスト
    socket.on('get-transcript', async (data) => {
      console.log('[WebSocket] get-transcriptリクエスト:', data);
      try {
        const { phoneNumber, callSid } = data;
        const normalizedPhone = phoneNumber?.startsWith('+81') 
          ? '0' + phoneNumber.substring(3) 
          : phoneNumber;
        
        // CallSidが指定されていない場合は、新しい通話なので空のトランスクリプトを返す
        if (!callSid) {
          console.log('[WebSocket] CallSid未指定 - 新しい通話のため空のトランスクリプトを返す');
          return;
        }
        
        // CallSidが指定されている場合は、その通話のトランスクリプトを取得
        console.log('[WebSocket] CallSid指定でトランスクリプト取得:', callSid);
        const callSession = await CallSession.findOne({
          twilioCallSid: callSid
        });
        
        if (callSession) {
          console.log(`[WebSocket] トランスクリプト取得: ${callSession._id}, エントリ数: ${callSession.transcript?.length || 0}`);
          
          // 重要: 常に新しい通話として扱い、既存のトランスクリプトは送信しない
          // これは、同じCallSidで新しい通話が開始される可能性があるため
          console.log('[WebSocket] 新しい通話として処理 - 既存トランスクリプトは送信しない');
          console.log('[WebSocket] CallSession情報:', {
            id: callSession._id,
            status: callSession.status,
            transcriptLength: callSession.transcript?.length || 0,
            createdAt: callSession.createdAt
          });
          
          // 既存のトランスクリプトをクリアしない（データベースの履歴として保持）
          // ただし、クライアントには送信しない
          return;
          
          if (callSession.transcript && callSession.transcript.length > 0) {
            // 既存の通話の場合のみ、トランスクリプトを順次送信
            console.log('[WebSocket] 既存の通話 - トランスクリプトを送信');
            callSession.transcript.forEach(entry => {
              socket.emit('transcript-update', {
                phoneNumber: normalizedPhone,
                callSid: callSession.twilioCallSid,
                callId: callSession._id.toString(),
                speaker: entry.speaker,
                message: entry.message,
                text: entry.message,
                timestamp: entry.timestamp
              });
            });
          } else {
            console.log('[WebSocket] トランスクリプトが空またはなし');
          }
        } else {
          console.log('[WebSocket] 該当する通話セッションが見つからない');
        }
      } catch (error) {
        console.error('[WebSocket] Error getting transcript:', error);
      }
    });

    // 通話引き継ぎリクエスト
    socket.on('request-handoff', async (data) => {
      const { callId, reason } = data;
      await this.handleHandoffRequest(socket, callId, reason);
    });

    // トランスクリプト更新購読
    socket.on('subscribe-transcript', (callId) => {
      socket.join(`transcript-${callId}`);
    });

    // トランスクリプト更新購読解除
    socket.on('unsubscribe-transcript', (callId) => {
      socket.leave(`transcript-${callId}`);
    });

    // 統計更新リクエスト
    socket.on('request-statistics', async () => {
      const stats = await this.getRealtimeStatistics();
      socket.emit('statistics-update', stats);
    });

    // 既存の通話データ取得リクエスト（モーダル再オープン時）
    socket.on('get-existing-call-data', async (data) => {
      console.log('[WebSocket] get-existing-call-dataリクエスト:', data);
      try {
        const { phoneNumber } = data;
        const normalizedPhone = phoneNumber?.startsWith('+81') 
          ? '0' + phoneNumber.substring(3) 
          : phoneNumber;
        
        console.log('[WebSocket] 既存通話データ検索:', { originalPhone: phoneNumber, normalizedPhone });
        
        // 電話番号からアクティブな通話セッションを検索
        const activeCall = await CallSession.findOne({
          phoneNumber: { $in: [phoneNumber, normalizedPhone] },
          status: { $in: ['calling', 'initiated', 'ai-responding', 'in-progress', 'human-connected', 'transferring'] }
        }).sort({ createdAt: -1 });
        
        if (activeCall) {
          console.log(`[WebSocket] アクティブな通話発見: ${activeCall._id}, status: ${activeCall.status}`);
          console.log(`[WebSocket] トランスクリプトエントリ数: ${activeCall.transcript?.length || 0}`);
          
          // 通話ステータスを送信
          socket.emit('call-status', {
            phoneNumber: normalizedPhone,
            status: activeCall.status,
            callSid: activeCall.twilioCallSid,
            callId: activeCall._id.toString()
          });
          
          // トランスクリプトが存在する場合は送信
          if (activeCall.transcript && activeCall.transcript.length > 0) {
            console.log('[WebSocket] 既存トランスクリプトを送信');
            activeCall.transcript.forEach((entry, index) => {
              console.log(`[WebSocket] トランスクリプト[${index}]: ${entry.speaker} - ${entry.message}`);
              socket.emit('transcript-update', {
                phoneNumber: normalizedPhone,
                callSid: activeCall.twilioCallSid,
                callId: activeCall._id.toString(),
                speaker: entry.speaker,
                message: entry.message,
                text: entry.message,
                timestamp: entry.timestamp
              });
            });
          } else {
            console.log('[WebSocket] トランスクリプトなし - 空の通話');
          }
        } else {
          console.log('[WebSocket] アクティブな通話が見つからない');
          // 通話が見つからない場合は、接続中状態を維持
          socket.emit('call-status', {
            phoneNumber: normalizedPhone,
            status: 'connecting'
          });
        }
      } catch (error) {
        console.error('[WebSocket] Error getting existing call data:', error);
        socket.emit('call-status', {
          phoneNumber: data.phoneNumber,
          status: 'connecting',
          error: error.message
        });
      }
    });
  }

  // アクティブな通話を送信
  async sendActiveCalls(socket) {
    try {
      // まず古い通話をクリーンアップ
      await this.cleanupStaleCallSessions();
      
      const activeCalls = await CallSession.getActiveCalls();
      
      // 5分以上前の通話は古いとみなす
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      
      // 実際にアクティブな通話のみフィルタリング（最近の通話のみ）
      const filteredCalls = activeCalls.filter(call => {
        // 古い通話は除外
        if (call.startTime < fiveMinutesAgo) {
          console.log(`[WebSocket] Ignoring stale call: ${call._id}, age: ${Math.floor((Date.now() - call.startTime) / 1000 / 60)}min`);
          return false;
        }
        
        // 通話が本当に進行中か確認（queuedは含まない）
        return call.twilioCallSid && 
               call.twilioCallSid !== 'pending' &&
               ['calling', 'initiated', 'ai-responding', 'in-progress', 'human-connected'].includes(call.status);
      });
      
      // 一斉通話では1社のみが通話中になるべき
      const actuallyActiveCalls = filteredCalls.slice(0, 1); // 最初の1件のみを送信
      
      console.log(`[WebSocket] Sending ${actuallyActiveCalls.length} active calls to socket ${socket.id}`);
      socket.emit('active-calls', actuallyActiveCalls);
    } catch (error) {
      console.error('Error sending active calls:', error);
      socket.emit('active-calls', []); // エラー時は空配列を送信
    }
  }
  
  // 古い通話セッションをクリーンアップ
  async cleanupStaleCallSessions() {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      
      const result = await CallSession.updateMany(
        {
          status: { $in: ['calling', 'initiated', 'ai-responding', 'in-progress', 'queued'] },
          startTime: { $lt: fiveMinutesAgo }
        },
        {
          $set: {
            status: 'completed',
            endTime: new Date(),
            callResult: 'タイムアウト'
          }
        }
      );
      
      if (result.modifiedCount > 0) {
        console.log(`[WebSocket] Cleaned up ${result.modifiedCount} stale call sessions`);
      }
    } catch (error) {
      console.error('[WebSocket] Error cleaning up stale sessions:', error);
    }
  }

  // エージェントのオンラインステータスを更新
  async updateAgentOnlineStatus(userId, isOnline) {
    try {
      // 開発環境のdev-userはスキップ
      if (typeof userId === 'string' && userId.startsWith('dev-user-')) {
        console.log(`[WebSocket] Skipping agent status update for dev user: ${userId}`);
        return;
      }
      
      let agentStatus = await AgentStatus.findOne({ userId });
      if (!agentStatus) {
        agentStatus = await AgentStatus.create({
          userId,
          status: isOnline ? 'available' : 'offline'
        });
      } else {
        agentStatus.status = isOnline ? 'available' : 'offline';
        agentStatus.lastActivity = new Date();
        await agentStatus.save();
      }
    } catch (error) {
      console.error('Error updating agent online status:', error);
    }
  }

  // エージェントステータスを更新
  async updateAgentStatus(userId, status) {
    try {
      const agentStatus = await AgentStatus.findOne({ userId });
      if (agentStatus) {
        await agentStatus.updateStatus(status);
      }
    } catch (error) {
      console.error('Error updating agent status:', error);
    }
  }

  // エージェントステータスをブロードキャスト
  broadcastAgentStatus(userId, status) {
    this.io.emit('agent-status-changed', {
      userId,
      status,
      timestamp: new Date()
    });
  }

  // 引き継ぎリクエストを処理
  async handleHandoffRequest(socket, callId, reason) {
    try {
      const call = await CallSession.findById(callId);
      if (!call || call.status !== 'ai-responding') {
        socket.emit('handoff-error', {
          message: 'Call is not available for handoff'
        });
        return;
      }

      // 引き継ぎ処理をトリガー（実際のAPIコールは別途）
      socket.emit('handoff-initiated', {
        callId,
        agentId: socket.userId
      });

      // 他のエージェントに通知
      socket.broadcast.emit('call-being-handled', {
        callId,
        agentId: socket.userId
      });
    } catch (error) {
      console.error('Error handling handoff request:', error);
      socket.emit('handoff-error', {
        message: 'Failed to process handoff request'
      });
    }
  }

  // リアルタイム統計を取得
  async getRealtimeStatistics() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const [totalCalls, activeCalls, availableAgents] = await Promise.all([
        CallSession.countDocuments({
          createdAt: { $gte: today }
        }),
        CallSession.countDocuments({
          status: { $in: ['initiated', 'ai-responding', 'transferring', 'human-connected'] }
        }),
        AgentStatus.countDocuments({
          status: 'available'
        })
      ]);

      return {
        totalCallsToday: totalCalls,
        activeCallsNow: activeCalls,
        availableAgents,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('Error getting realtime statistics:', error);
      return null;
    }
  }

  // 通話イベントをブロードキャスト
  broadcastCallEvent(event, data) {
    console.log('========== WebSocket broadcastCallEvent ==========');
    console.log('[WebSocket] イベント:', event);
    console.log('[WebSocket] データ:', JSON.stringify(data, null, 2));
    
    if (this.io) {
      const connectedSockets = this.io.sockets.sockets.size;
      console.log('[WebSocket] 接続中のソケット数:', connectedSockets);
      console.log('[WebSocket] 接続中のユーザー数:', this.connectedUsers.size);
      
      this.io.emit(event, data);
      console.log(`[WebSocket] イベント '${event}' を ${connectedSockets} クライアントに送信しました`);
    } else {
      console.error('[WebSocket] ERROR: io is not initialized');
    }
    console.log('==================================================');
  }

  // 特定の通話ルームにイベントを送信
  sendToCallRoom(callId, event, data) {
    if (this.io) {
      this.io.to(`call-${callId}`).emit(event, data);
    }
  }

  // トランスクリプト更新を送信
  sendTranscriptUpdate(callId, transcriptData) {
    // 会話内容をログに出力
    console.log('============================================');
    console.log('[WebSocket会話ログ] トランスクリプト更新');
    console.log(`[WebSocket会話ログ] CallId: ${callId}`);
    console.log(`[WebSocket会話ログ] 話者: ${transcriptData.speaker}`);
    console.log(`[WebSocket会話ログ] 内容: "${transcriptData.message}"`);
    console.log(`[WebSocket会話ログ] 電話番号: ${transcriptData.phoneNumber || '不明'}`);
    console.log(`[WebSocket会話ログ] タイムスタンプ: ${transcriptData.timestamp || new Date().toISOString()}`);
    console.log('============================================');
    
    if (this.io) {
      // callIdも含めて送信
      const dataWithCallId = { ...transcriptData, callId };
      
      // 電話番号ベースのルームにのみ送信（重複を防ぐため）
      if (transcriptData.phoneNumber) {
        const normalizedPhone = transcriptData.phoneNumber.startsWith('+81') 
          ? '0' + transcriptData.phoneNumber.substring(3) 
          : transcriptData.phoneNumber;
        this.io.to(`call-${normalizedPhone}`).emit('transcript-update', dataWithCallId);
        console.log(`[WebSocket会話ログ] 電話番号ルーム call-${normalizedPhone} に送信`);
      } else {
        // 電話番号がない場合はcallIdベースのルームに送信
        this.io.to(`transcript-${callId}`).emit('transcript-update', dataWithCallId);
        console.log(`[WebSocket会話ログ] callIdルーム transcript-${callId} に送信`);
      }
    }
  }

  // 特定のユーザーにメッセージを送信
  sendToUser(userId, event, data) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId && this.io) {
      this.io.to(socketId).emit(event, data);
    }
  }

  // 接続中のユーザー数を取得
  getConnectedUsersCount() {
    return this.connectedUsers.size;
  }

  // 特定のユーザーが接続中か確認
  isUserConnected(userId) {
    return this.connectedUsers.has(userId);
  }
}

module.exports = new WebSocketService();