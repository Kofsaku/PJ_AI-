const twilioService = require('../services/twilioService');
const CallSession = require('../models/CallSession');
const Customer = require('../models/Customer');
const AgentSettings = require('../models/AgentSettings');
const webSocketService = require('../services/websocket');

// 通話タイムアウト設定（ミリ秒）
const CALL_TIMEOUT = {
  NO_ANSWER: 30000,     // 30秒: 顧客が応答しない場合
  MAX_DURATION: 300000, // 5分: 最大通話時間
  BETWEEN_CALLS: 3000   // 3秒: 次の通話までの待機時間
};

// 通話キュー管理
class CallQueueManager {
  constructor() {
    this.queue = [];
    this.currentCall = null;
    this.isProcessing = false;
    this.timeoutHandlers = new Map();
    this.callCompletionHandlers = new Map(); // 通話完了待機用
    this.recentCalls = new Map(); // 最近の発信記録 {phoneNumber: timestamp}
  }

  // キューに通話を追加
  addToQueue(callData) {
    this.queue.push(callData);
    console.log(`[CallQueue] Added to queue. Queue size: ${this.queue.length}, Processing: ${this.isProcessing}`);
    if (!this.isProcessing) {
      this.processNextCall();
    }
  }

  // 一括でキューに追加（新規メソッド）
  addBulkToQueue(callDataArray) {
    if (!Array.isArray(callDataArray) || callDataArray.length === 0) {
      console.log('[CallQueue] No data to add to queue');
      return;
    }
    
    const previousSize = this.queue.length;
    this.queue.push(...callDataArray);
    console.log(`[CallQueue] Bulk added ${callDataArray.length} calls. Queue size: ${previousSize} -> ${this.queue.length}`);
    
    // 処理中でない場合は処理を開始
    if (!this.isProcessing) {
      console.log('[CallQueue] Starting queue processing...');
      this.processNextCall();
    } else {
      console.log('[CallQueue] Already processing, new calls will be processed after current call');
    }
  }

  // 次の通話を処理
  async processNextCall() {
    if (this.isProcessing) {
      console.log('[CallQueue] Already processing a call, skipping');
      return;
    }

    if (this.queue.length === 0) {
      console.log('[CallQueue] No more calls in queue - all calls completed');
      this.currentCall = null;
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;
    const callData = this.queue.shift();
    
    try {
      console.log(`[CallQueue] ========== Processing Call ${this.queue.length + 1} ==========`);
      console.log(`[CallQueue] Phone: ${callData.phoneNumber}`);
      console.log(`[CallQueue] Remaining in queue: ${this.queue.length}`);
      this.currentCall = callData;
      
      // 通話を開始して完了を待つ
      await this.initiateCall(callData);
      
      // この通話の完了を待つためのPromiseを作成
      await this.waitForCallCompletion(callData.session._id);
      
    } catch (error) {
      console.error('[CallQueue] Error processing call:', error);
      // エラーが発生した通話のセッションを失敗状態に更新
      try {
        if (callData && callData.session) {
          callData.session.status = 'failed';
          callData.session.endTime = new Date();
          callData.session.error = error.message;
          await callData.session.save();
          
          webSocketService.broadcastCallEvent('call-failed', {
            sessionId: callData.session._id,
            phoneNumber: callData.phoneNumber,
            error: error.message
          });
        }
      } catch (updateError) {
        console.error('[CallQueue] Failed to update error status:', updateError);
      }
    } finally {
      // 通話が完了したら次の通話まで3秒待機
      console.log(`[CallQueue] Call completed. Queue has ${this.queue.length} calls remaining`);
      
      if (this.queue.length > 0) {
        console.log('[CallQueue] Waiting 3 seconds before next call...');
      } else {
        console.log('[CallQueue] No more calls in queue');
      }
      
      setTimeout(() => {
        this.isProcessing = false;
        this.currentCall = null;
        // キューに残りがある限り処理を継続
        if (this.queue.length > 0) {
          this.processNextCall();
        }
      }, CALL_TIMEOUT.BETWEEN_CALLS);
    }
  }

  // 通話完了を待つ
  waitForCallCompletion(sessionId) {
    return new Promise((resolve) => {
      const sessionIdStr = sessionId.toString();
      
      const checkCompletion = async () => {
        try {
          const session = await CallSession.findById(sessionId);
          if (!session || ['completed', 'failed', 'cancelled'].includes(session.status)) {
            console.log(`[CallQueue] Call ${sessionId} completed with status: ${session?.status}`);
            this.cleanupCompletionHandler(sessionIdStr);
            resolve();
          }
        } catch (dbError) {
          console.error(`[CallQueue] Database error while checking completion for ${sessionId}:`, dbError);
          // DB接続エラーの場合は一時的にスキップし、次回チェックを続行
        }
      };
      
      // 1秒ごとに通話状態をチェック
      const intervalId = setInterval(checkCompletion, 1000);
      
      // 最大待機時間後は強制的に次へ
      const timeoutId = setTimeout(() => {
        console.log(`[CallQueue] Call ${sessionId} timeout, moving to next`);
        this.cleanupCompletionHandler(sessionIdStr);
        resolve();
      }, CALL_TIMEOUT.MAX_DURATION + 10000); // 少し余裕を持たせる
      
      // 両方のハンドラーを保存
      this.callCompletionHandlers.set(sessionIdStr, {
        intervalId,
        timeoutId
      });
    });
  }

  // 完了待機ハンドラーのクリーンアップ
  cleanupCompletionHandler(sessionIdStr) {
    const handlers = this.callCompletionHandlers.get(sessionIdStr);
    if (handlers) {
      clearInterval(handlers.intervalId);
      clearTimeout(handlers.timeoutId);
      this.callCompletionHandlers.delete(sessionIdStr);
    }
  }

  // 通話を開始
  async initiateCall(callData) {
    const { phoneNumber, session, userId } = callData;
    
    try {
      // 同一番号への短時間発信チェック
      const lastCallTime = this.recentCalls.get(phoneNumber);
      const now = Date.now();
      const MIN_INTERVAL = 30000; // 30秒間隔を強制
      
      if (lastCallTime && (now - lastCallTime) < MIN_INTERVAL) {
        const waitTime = MIN_INTERVAL - (now - lastCallTime);
        console.log(`[CallQueue] Same number called recently. Waiting ${Math.ceil(waitTime/1000)} seconds for ${phoneNumber}`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      
      // 発信記録を更新
      this.recentCalls.set(phoneNumber, Date.now());
      
      // 古い記録をクリーンアップ（1時間以上前の記録を削除）
      for (const [phone, timestamp] of this.recentCalls.entries()) {
        if (Date.now() - timestamp > 3600000) { // 1時間
          this.recentCalls.delete(phone);
        }
      }
      
      // Twilioで通話を開始
      const call = await twilioService.makeCall(phoneNumber, session._id, userId);
      
      session.twilioCallSid = call.sid;
      session.status = 'calling';
      await session.save();
      
      // WebSocketで通知
      webSocketService.broadcastCallEvent('call-initiated', {
        sessionId: session._id,
        phoneNumber: phoneNumber,
        customerId: session.customerId, // 顧客IDを追加
        status: 'calling'
      });
      
      // タイムアウト設定
      this.setupTimeouts(session);
      
    } catch (error) {
      console.error('[CallQueue] Failed to initiate call:', error);
      session.status = 'failed';
      session.error = error.message;
      await session.save();
      
      webSocketService.broadcastCallEvent('call-failed', {
        sessionId: session._id,
        phoneNumber: phoneNumber,
        error: error.message
      });
    }
  }

  // タイムアウト設定
  setupTimeouts(session) {
    // 応答なしタイムアウト
    const noAnswerTimeout = setTimeout(async () => {
      const currentSession = await CallSession.findById(session._id);
      
      // まだcalling状態の場合は無応答として終了
      if (currentSession && currentSession.status === 'calling') {
        console.log('[CallTimeout] No answer for:', session.phoneNumber);
        await this.terminateCall(session._id, 'no-answer');
      }
    }, CALL_TIMEOUT.NO_ANSWER);
    
    // 最大通話時間タイムアウト
    const maxDurationTimeout = setTimeout(async () => {
      const currentSession = await CallSession.findById(session._id);
      
      // まだ通話中の場合は強制終了
      if (currentSession && ['in-progress', 'ai-responding'].includes(currentSession.status)) {
        console.log('[CallTimeout] Max duration reached for:', session.phoneNumber);
        await this.terminateCall(session._id, 'max-duration');
      }
    }, CALL_TIMEOUT.MAX_DURATION);
    
    this.timeoutHandlers.set(session._id.toString(), {
      noAnswer: noAnswerTimeout,
      maxDuration: maxDurationTimeout
    });
  }

  // タイムアウトクリア
  clearTimeouts(sessionId) {
    const timeouts = this.timeoutHandlers.get(sessionId.toString());
    if (timeouts) {
      clearTimeout(timeouts.noAnswer);
      clearTimeout(timeouts.maxDuration);
      this.timeoutHandlers.delete(sessionId.toString());
    }
  }

  // 全ての通話を停止
  async stopAllCalls() {
    console.log('[CallQueue] Stopping all calls...');
    
    // キューをクリア
    const queuedCalls = [...this.queue];
    this.queue = [];
    this.isProcessing = false;
    
    // キュー中の通話をキャンセル
    for (const callData of queuedCalls) {
      try {
        callData.session.status = 'cancelled';
        callData.session.endTime = new Date();
        callData.session.callResult = 'キャンセル';
        await callData.session.save();
      } catch (error) {
        console.error('[StopAll] Error cancelling queued call:', error);
      }
    }
    
    // 現在の通話を終了
    if (this.currentCall) {
      await this.terminateCall(this.currentCall.session._id, 'stopped');
    }
    
    // 全てのタイムアウトをクリア
    for (const [sessionId, timeouts] of this.timeoutHandlers) {
      clearTimeout(timeouts.noAnswer);
      clearTimeout(timeouts.maxDuration);
    }
    this.timeoutHandlers.clear();
    
    // 全ての完了待機ハンドラーをクリア
    for (const [sessionId, handlers] of this.callCompletionHandlers) {
      if (handlers.intervalId) clearInterval(handlers.intervalId);
      if (handlers.timeoutId) clearTimeout(handlers.timeoutId);
    }
    this.callCompletionHandlers.clear();
    
    return {
      cancelledInQueue: queuedCalls.length,
      stoppedCurrent: !!this.currentCall
    };
  }

  // 通話終了処理
  async terminateCall(sessionId, reason) {
    try {
      const session = await CallSession.findById(sessionId);
      if (!session) return;
      
      // タイムアウトクリア
      this.clearTimeouts(sessionId);
      
      // Twilioで通話を終了
      if (session.twilioCallSid) {
        try {
          const client = require('twilio')(
            process.env.TWILIO_ACCOUNT_SID,
            process.env.TWILIO_AUTH_TOKEN
          );
          await client.calls(session.twilioCallSid).update({ status: 'completed' });
        } catch (twilioError) {
          console.error('[CallTerminate] Twilio error:', twilioError);
        }
      }
      
      // セッション更新
      session.status = 'completed';
      session.endTime = new Date();
      session.callResult = reason === 'no-answer' ? '不在' : '完了';
      await session.save();
      
      // WebSocketで通知
      webSocketService.broadcastCallEvent('call-terminated', {
        sessionId: session._id,
        phoneNumber: session.phoneNumber,
        customerId: session.customerId, // 顧客IDを追加
        reason: reason
      });
      
      console.log(`[CallTerminate] Call terminated: ${session.phoneNumber} (${reason})`);
      
    } catch (error) {
      console.error('[CallTerminate] Error:', error);
    }
  }
}

// グローバルキューマネージャー
const callQueueManager = new CallQueueManager();

// 一斉通話の開始（順次発信版）
exports.initiateBulkCalls = async (req, res) => {
  console.log('=== Bulk Call Request (Sequential) ===');
  console.log('Request Body:', req.body);
  console.log('User:', req.user);
  
  try {
    const { phoneNumbers, customerIds } = req.body;
    const userId = req.user?._id || req.user?.id;

    if (!phoneNumbers || phoneNumbers.length === 0) {
      return res.status(400).json({ 
        error: 'No phone numbers provided' 
      });
    }

    // エージェント設定を取得
    let agentSettings = null;
    if (userId) {
      agentSettings = await AgentSettings.findOne({ userId });
      console.log('[BulkCall] Agent settings:', agentSettings ? 'found' : 'not found');
    }
    
    const createdSessions = [];
    const queueData = [];
    
    // まず全てのセッションを作成
    for (let i = 0; i < phoneNumbers.length; i++) {
      const phoneNumber = phoneNumbers[i];
      const customerId = customerIds ? customerIds[i] : null;

      // セッション作成
      const sessionData = {
        phoneNumber,
        customerId,
        companyId: req.user.companyId, // companyIdを追加
        status: 'queued', // 新しいステータス: キュー待ち
        startTime: new Date(),
        assignedAgent: userId,
      };
      
      // AI設定を追加
      if (agentSettings?.conversationSettings) {
        sessionData.aiConfiguration = {
          companyName: agentSettings.conversationSettings.companyName,
          serviceName: agentSettings.conversationSettings.serviceName,
          representativeName: agentSettings.conversationSettings.representativeName,
          targetDepartment: agentSettings.conversationSettings.targetDepartment
        };
      }

      const session = new CallSession(sessionData);
      await session.save();
      createdSessions.push(session);
      
      // キューデータを準備
      queueData.push({
        phoneNumber,
        session,
        userId
      });
    }
    
    // 全てのセッションを作成後、一括でキューに追加（修正済み）
    if (queueData.length > 0) {
      console.log(`[BulkCall] ========================================`);
      console.log(`[BulkCall] Adding ${queueData.length} calls to queue`);
      console.log(`[BulkCall] Phone numbers: ${queueData.map(d => d.phoneNumber).join(', ')}`);
      
      // 全ての通話データを一括でキューに追加
      callQueueManager.addBulkToQueue(queueData);
      
      console.log(`[BulkCall] All calls added to queue successfully`);
      console.log(`[BulkCall] ========================================`);
    }

    // WebSocketで通知
    webSocketService.broadcastCallEvent('bulk-calls-queued', {
      totalCalls: createdSessions.length,
      sessions: createdSessions.map(s => ({
        id: s._id,
        phoneNumber: s.phoneNumber,
        customerId: s.customerId, // 顧客IDを追加
        status: s.status
      }))
    });

    res.status(200).json({
      message: `Queued ${createdSessions.length} calls for sequential processing`,
      sessions: createdSessions.map(s => ({
        id: s._id,
        phoneNumber: s.phoneNumber,
        status: s.status
      }))
    });

  } catch (error) {
    console.error('Bulk call error:', error);
    res.status(500).json({ 
      error: 'Failed to initiate bulk calls',
      details: error.message 
    });
  }
};

// 通話ステータス更新のハンドラー
exports.handleCallStatusUpdate = async (req, res) => {
  const { CallStatus, CallSid } = req.body;
  
  try {
    const session = await CallSession.findOne({ twilioCallSid: CallSid });
    if (!session) {
      return res.status(404).send('Session not found');
    }
    
    // ステータス更新
    const previousStatus = session.status;
    
    switch (CallStatus) {
      case 'in-progress':
        session.status = 'in-progress';
        // 応答があったのでno-answerタイムアウトをクリア
        const timeouts = callQueueManager.timeoutHandlers.get(session._id.toString());
        if (timeouts?.noAnswer) {
          clearTimeout(timeouts.noAnswer);
        }
        break;
        
      case 'completed':
      case 'failed':
      case 'busy':
      case 'no-answer':
        session.status = 'completed';
        session.endTime = new Date();
        session.callResult = CallStatus === 'completed' ? '完了' : 
                           CallStatus === 'no-answer' ? '不在' :
                           CallStatus === 'busy' ? '話中' : '失敗';
        callQueueManager.clearTimeouts(session._id);
        break;
    }
    
    await session.save();
    
    // WebSocketで通知
    webSocketService.broadcastCallEvent('call-status-update', {
      sessionId: session._id,
      phoneNumber: session.phoneNumber,
      customerId: session.customerId, // 顧客IDを追加
      status: session.status,
      callResult: session.callResult
    });
    
    res.status(200).send('OK');
    
  } catch (error) {
    console.error('[CallStatusUpdate] Error:', error);
    res.status(500).send('Error');
  }
};

// 手動で通話を終了
exports.terminateCall = async (req, res) => {
  const { sessionId } = req.params;
  
  try {
    await callQueueManager.terminateCall(sessionId, 'manual');
    res.status(200).json({ success: true, message: 'Call terminated' });
  } catch (error) {
    console.error('[TerminateCall] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// 全ての一斉通話を停止
exports.stopAllBulkCalls = async (req, res) => {
  try {
    const result = await callQueueManager.stopAllCalls();
    
    // アクティブな通話を全て終了
    const activeSessions = await CallSession.find({
      status: { $in: ['calling', 'queued', 'in-progress', 'ai-responding'] }
    });
    
    for (const session of activeSessions) {
      try {
        await callQueueManager.terminateCall(session._id, 'stopped');
      } catch (error) {
        console.error('[StopAll] Error terminating active session:', error);
      }
    }
    
    // WebSocketで通知
    webSocketService.broadcastCallEvent('bulk-calls-stopped', {
      ...result,
      totalStopped: result.cancelledInQueue + (result.stoppedCurrent ? 1 : 0) + activeSessions.length
    });
    
    res.status(200).json({
      success: true,
      message: 'All bulk calls stopped',
      ...result,
      activeStopped: activeSessions.length
    });
  } catch (error) {
    console.error('[StopAllCalls] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// 古いセッションのクリーンアップ
exports.cleanupOldSessions = async (req, res) => {
  try {
    const cutoffTime = new Date(Date.now() - 30 * 60 * 1000); // 30分前
    
    // 30分以上前の未完了セッションを完了に
    const result = await CallSession.updateMany(
      {
        status: { $in: ['calling', 'queued', 'in-progress', 'ai-responding'] },
        startTime: { $lt: cutoffTime }
      },
      {
        $set: {
          status: 'completed',
          endTime: new Date(),
          callResult: 'タイムアウト'
        }
      }
    );
    
    console.log(`[Cleanup] Cleaned up ${result.modifiedCount} stale sessions`);
    
    if (res) {
      res.status(200).json({
        success: true,
        message: `Cleaned up ${result.modifiedCount} stale sessions`
      });
    }
    
    return result;
  } catch (error) {
    console.error('[Cleanup] Error:', error);
    if (res) {
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
    throw error;
  }
};

module.exports = exports;