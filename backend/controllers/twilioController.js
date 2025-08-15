const asyncHandler = require('../middlewares/asyncHandler');
const twilio = require('twilio');
const CallSession = require('../models/CallSession');
const AgentSettings = require('../models/AgentSettings');
const conversationEngine = require('../services/conversationEngine');
const webSocketService = require('../services/websocket');

// Twilio client
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// TwiML Voice Response helper
const VoiceResponse = twilio.twiml.VoiceResponse;

// @desc    Generate TwiML for Conference with AI
// @route   POST /api/twilio/voice/conference/:callId
// @access  Public (Twilio webhook)
exports.generateConferenceTwiML = asyncHandler(async (req, res) => {
  const { callId } = req.params;
  const twiml = new VoiceResponse();

  try {
    // 通話セッションを取得
    const callSession = await CallSession.findById(callId)
      .populate('customerId');

    if (!callSession) {
      twiml.say({ voice: 'Polly.Mizuki', language: 'ja-JP' }, 
        'システムエラーが発生しました。申し訳ございません。');
      twiml.hangup();
      return res.type('text/xml').send(twiml.toString());
    }

    // AI設定から初期メッセージを生成
    const initialMessage = await conversationEngine.generateResponse(callId, 'initial');
    
    // 初期挨拶
    twiml.say({ voice: 'Polly.Mizuki', language: 'ja-JP' }, initialMessage);

    // Conferenceに参加
    const dial = twiml.dial({
      action: `/api/twilio/voice/conference/status/${callId}`,
      method: 'POST'
    });

    dial.conference({
      statusCallback: `/api/twilio/conference/events/${callId}`,
      statusCallbackEvent: 'start end join leave mute hold',
      statusCallbackMethod: 'POST',
      waitUrl: 'http://twimlets.com/holdmusic?Bucket=com.twilio.music.classical',
      record: 'record-from-start',
      recordingStatusCallback: `/api/twilio/recording/status/${callId}`,
      recordingStatusCallbackMethod: 'POST'
    }, `call-${callId}`);

    // 会話エンジンを初期化
    conversationEngine.initializeConversation(callId, callSession.aiConfiguration);

    res.type('text/xml').send(twiml.toString());
  } catch (error) {
    console.error('Error generating conference TwiML:', error);
    twiml.say({ voice: 'Polly.Mizuki', language: 'ja-JP' }, 
      'システムエラーが発生しました。');
    twiml.hangup();
    res.type('text/xml').send(twiml.toString());
  }
});

// @desc    Generate TwiML for agent joining conference
// @route   POST /api/twilio/voice/conference/agent/:conferenceName
// @access  Public (Twilio webhook)
exports.agentJoinConference = asyncHandler(async (req, res) => {
  const { conferenceName } = req.params;
  const twiml = new VoiceResponse();

  twiml.say({ voice: 'Polly.Mizuki', language: 'ja-JP' }, 
    '顧客との通話に接続します。');

  const dial = twiml.dial();
  dial.conference({
    statusCallback: `/api/twilio/conference/agent-events`,
    statusCallbackEvent: 'join leave',
    statusCallbackMethod: 'POST',
    endConferenceOnExit: true // エージェントが退出したら会議を終了
  }, conferenceName);

  res.type('text/xml').send(twiml.toString());
});

// @desc    Handle speech recognition and generate AI response
// @route   POST /api/twilio/voice/gather/:callId
// @access  Public (Twilio webhook)
exports.handleSpeechInput = asyncHandler(async (req, res) => {
  const { callId } = req.params;
  const { SpeechResult, Confidence } = req.body;
  const twiml = new VoiceResponse();

  try {
    // 音声認識結果を分類
    const classification = conversationEngine.classifyResponse(SpeechResult, callId);

    // トランスクリプトを更新
    await CallSession.findByIdAndUpdate(callId, {
      $push: {
        transcript: {
          speaker: 'customer',
          message: SpeechResult,
          confidence: parseFloat(Confidence) || 0
        }
      }
    });

    // WebSocketで文字起こしを送信
    webSocketService.sendTranscriptUpdate(callId, {
      speaker: 'customer',
      message: SpeechResult,
      timestamp: new Date()
    });

    // 引き継ぎが必要な場合
    if (classification.shouldHandoff) {
      // 引き継ぎメッセージを再生
      const handoffMessage = await conversationEngine.generateResponse(callId, 'handoff_message');
      twiml.say({ voice: 'Polly.Mizuki', language: 'ja-JP' }, handoffMessage);
      
      // 引き継ぎ処理をトリガー
      await triggerHandoff(callId, classification.intent);
      
      // 保留音楽を再生
      twiml.play({ loop: 0 }, 'http://twimlets.com/holdmusic?Bucket=com.twilio.music.classical');
    } else {
      // AI応答を生成
      const aiResponse = await conversationEngine.generateResponse(callId, classification.intent);
      
      // AIの応答を記録
      await CallSession.findByIdAndUpdate(callId, {
        $push: {
          transcript: {
            speaker: 'ai',
            message: aiResponse,
            confidence: 1.0
          }
        }
      });

      // WebSocketで文字起こしを送信
      webSocketService.sendTranscriptUpdate(callId, {
        speaker: 'ai',
        message: aiResponse,
        timestamp: new Date()
      });

      // 応答を再生して次の入力を待つ
      if (classification.nextAction === 'end_call') {
        twiml.say({ voice: 'Polly.Mizuki', language: 'ja-JP' }, aiResponse);
        twiml.hangup();
      } else {
        const gather = twiml.gather({
          input: 'speech',
          language: 'ja-JP',
          speechTimeout: 3,
          action: `/api/twilio/voice/gather/${callId}`,
          method: 'POST'
        });
        gather.say({ voice: 'Polly.Mizuki', language: 'ja-JP' }, aiResponse);
      }
    }

    res.type('text/xml').send(twiml.toString());
  } catch (error) {
    console.error('Error handling speech input:', error);
    twiml.say({ voice: 'Polly.Mizuki', language: 'ja-JP' }, 
      '申し訳ございません。システムエラーが発生しました。');
    twiml.hangup();
    res.type('text/xml').send(twiml.toString());
  }
});

// @desc    Generate handoff message TwiML
// @route   POST /api/twilio/voice/handoff-message
// @access  Public (Twilio webhook)
exports.generateHandoffMessage = asyncHandler(async (req, res) => {
  const twiml = new VoiceResponse();
  
  twiml.say({ voice: 'Polly.Mizuki', language: 'ja-JP' }, 
    '担当者におつなぎいたします。少々お待ちください。');
  
  res.type('text/xml').send(twiml.toString());
});

// @desc    Handle conference events
// @route   POST /api/twilio/conference/events/:callId
// @access  Public (Twilio webhook)
exports.handleConferenceEvents = asyncHandler(async (req, res) => {
  const { callId } = req.params;
  const { 
    StatusCallbackEvent, 
    ConferenceSid,
    CallSid,
    Muted,
    Hold
  } = req.body;

  try {
    // Conference SIDを保存
    if (StatusCallbackEvent === 'start') {
      await CallSession.findByIdAndUpdate(callId, {
        conferenceSid: ConferenceSid
      });
    }

    // WebSocketでイベントを通知
    webSocketService.sendToCallRoom(callId, 'conference-event', {
      event: StatusCallbackEvent,
      conferenceSid: ConferenceSid,
      callSid: CallSid,
      muted: Muted,
      hold: Hold,
      timestamp: new Date()
    });

    // エージェントが参加した場合
    if (StatusCallbackEvent === 'join' && req.body.Coaching === 'false') {
      await CallSession.findByIdAndUpdate(callId, {
        status: 'human-connected'
      });

      webSocketService.broadcastCallEvent('call-updated', {
        callId,
        status: 'human-connected'
      });
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error handling conference event:', error);
    res.status(500).send('Error');
  }
});

// @desc    Handle call status callbacks
// @route   POST /api/twilio/call/status/:callId
// @access  Public (Twilio webhook)
exports.handleCallStatus = asyncHandler(async (req, res) => {
  const { callId } = req.params;
  const { CallStatus, CallSid, Duration } = req.body;

  try {
    const updateData = {
      twilioCallSid: CallSid
    };

    // ステータスに応じて更新
    switch (CallStatus) {
      case 'initiated':
      case 'ringing':
        updateData.status = 'initiated';
        break;
      case 'in-progress':
        updateData.status = 'ai-responding';
        break;
      case 'completed':
      case 'failed':
      case 'busy':
      case 'no-answer':
        updateData.status = CallStatus === 'completed' ? 'completed' : 'failed';
        updateData.endTime = new Date();
        if (Duration) {
          updateData.duration = parseInt(Duration);
        }
        
        // 会話エンジンをクリア
        conversationEngine.clearConversation(callId);
        break;
    }

    await CallSession.findByIdAndUpdate(callId, updateData);

    // WebSocketで通知
    webSocketService.broadcastCallEvent('call-status-changed', {
      callId,
      status: CallStatus,
      duration: Duration
    });

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error handling call status:', error);
    res.status(500).send('Error');
  }
});

// @desc    Handle recording status
// @route   POST /api/twilio/recording/status/:callId
// @access  Public (Twilio webhook)
exports.handleRecordingStatus = asyncHandler(async (req, res) => {
  const { callId } = req.params;
  const { RecordingUrl, RecordingSid, RecordingStatus } = req.body;

  try {
    if (RecordingStatus === 'completed' && RecordingUrl) {
      await CallSession.findByIdAndUpdate(callId, {
        recordingUrl: RecordingUrl
      });

      // WebSocketで通知
      webSocketService.sendToCallRoom(callId, 'recording-available', {
        recordingUrl: RecordingUrl,
        recordingSid: RecordingSid
      });
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error handling recording status:', error);
    res.status(500).send('Error');
  }
});

// 引き継ぎ処理をトリガー（内部関数）
async function triggerHandoff(callId, reason) {
  try {
    // 利用可能なエージェントを取得
    const AgentStatus = require('../models/AgentStatus');
    const availableAgent = await AgentStatus.getLeastBusyAgent();

    if (!availableAgent) {
      console.error('No available agents for handoff');
      return;
    }

    // エージェント設定を取得
    const agentSettings = await AgentSettings.findOne({ 
      userId: availableAgent.userId 
    });

    if (!agentSettings) {
      console.error('Agent settings not found');
      return;
    }

    // Conference名
    const conferenceName = `call-${callId}`;
    const agentPhoneNumber = agentSettings.getInternationalPhoneNumber();

    // エージェントをConferenceに追加
    const agentCall = await client.calls.create({
      to: agentPhoneNumber,
      from: process.env.TWILIO_PHONE_NUMBER,
      url: `${process.env.BASE_URL}/api/twilio/voice/conference/agent/${conferenceName}`,
      statusCallback: `${process.env.BASE_URL}/api/twilio/call/agent-status/${callId}`
    });

    // 通話セッションを更新
    await CallSession.findByIdAndUpdate(callId, {
      status: 'transferring',
      assignedAgent: availableAgent.userId,
      handoffTime: new Date(),
      handoffReason: reason
    });

    // エージェントステータスを更新
    await availableAgent.updateStatus('on-call', callId);

    // WebSocketで通知
    webSocketService.broadcastCallEvent('call-handoff-initiated', {
      callId,
      agentId: availableAgent.userId,
      agentCallSid: agentCall.sid
    });
  } catch (error) {
    console.error('Error triggering handoff:', error);
  }
}

module.exports = exports;