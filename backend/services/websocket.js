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
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true
      }
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
      console.log(`User ${socket.userId} connected`);
      this.handleConnection(socket);

      // イベントリスナーの設定
      this.setupEventListeners(socket);

      // 切断イベント
      socket.on('disconnect', () => {
        console.log(`User ${socket.userId} disconnected`);
        this.handleDisconnection(socket);
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
  }

  // アクティブな通話を送信
  async sendActiveCalls(socket) {
    try {
      const activeCalls = await CallSession.getActiveCalls();
      socket.emit('active-calls', activeCalls);
    } catch (error) {
      console.error('Error sending active calls:', error);
    }
  }

  // エージェントのオンラインステータスを更新
  async updateAgentOnlineStatus(userId, isOnline) {
    try {
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
    if (this.io) {
      this.io.emit(event, data);
    }
  }

  // 特定の通話ルームにイベントを送信
  sendToCallRoom(callId, event, data) {
    if (this.io) {
      this.io.to(`call-${callId}`).emit(event, data);
    }
  }

  // トランスクリプト更新を送信
  sendTranscriptUpdate(callId, transcriptData) {
    if (this.io) {
      this.io.to(`transcript-${callId}`).emit('transcript-update', transcriptData);
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