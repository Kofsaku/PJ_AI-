const asyncHandler = require('../middlewares/asyncHandler');
const twilio = require('twilio');
const CallSession = require('../models/CallSession');
const Customer = require('../models/Customer');
const AgentSettings = require('../models/AgentSettings');
const conversationEngine = require('../services/conversationEngine');
const coefontService = require('../services/coefontService');

// TwiML Voice Response helper
const VoiceResponse = twilio.twiml.VoiceResponse;

// @desc    Handle incoming voice call from Twilio
// @route   POST /api/twilio/voice
// @access  Public (Twilio webhook)
exports.handleIncomingCall = asyncHandler(async (req, res) => {
  console.log('============================================');
  console.log('[Incoming Call] NEW CALL RECEIVED');
  console.log('[Incoming Call] From:', req.body.From);
  console.log('[Incoming Call] To:', req.body.To);
  console.log('[Incoming Call] CallSid:', req.body.CallSid);
  console.log('[Incoming Call] CallStatus:', req.body.CallStatus);
  console.log('============================================');
  
  const { From, To, CallSid } = req.body;
  const twiml = new VoiceResponse();

  // エラーレスポンスを返す関数
  const sendErrorResponse = async (message, error = null) => {
    console.error('[Incoming Call] ERROR:', message);
    if (error) {
      console.error('[Incoming Call] Error details:', error);
      console.error('[Incoming Call] Stack:', error.stack);
    }
    const errorTwiml = new VoiceResponse();
    // CoeFontを使用（エラー時は同期的に処理）
    try {
      await coefontService.getTwilioPlayElement(errorTwiml, message);
    } catch (e) {
      errorTwiml.say({ voice: 'Polly.Mizuki', language: 'ja-JP' }, message);
    }
    errorTwiml.hangup();
    return res.type('text/xml').send(errorTwiml.toString());
  };

  try {
    // 電話番号から顧客を検索または作成
    let phoneNumber = From;
    // 国際フォーマットから日本のフォーマットに変換
    if (phoneNumber.startsWith('+81')) {
      phoneNumber = '0' + phoneNumber.substring(3);
    }
    
    let customer = await Customer.findOne({ phone: phoneNumber });
    if (!customer) {
      // 新規顧客として作成
      const now = new Date();
      customer = await Customer.create({
        customer: '新規顧客',
        company: '未設定',
        phone: phoneNumber,
        date: now.toLocaleDateString('ja-JP'),
        time: now.toLocaleTimeString('ja-JP'),
        duration: '0:00',
        result: '通話中'
      });
      console.log('[Incoming Call] New customer created:', customer._id);
    } else {
      console.log('[Incoming Call] Existing customer found:', customer._id);
    }
    
    // デフォルトのエージェント設定を取得
    console.log('[Incoming Call] Looking for agent settings...');
    const agentSettings = await AgentSettings.findOne();
    if (!agentSettings) {
      return sendErrorResponse('エージェント設定が見つかりません。システム管理者にお問い合わせください。');
    }
    console.log('[Incoming Call] Agent settings found:', agentSettings._id);
    
    // 通話セッションを検索または作成
    let callSession = await CallSession.findOne({ twilioCallSid: CallSid });
    
    if (callSession) {
      console.log('[Incoming Call] Existing call session found:', callSession._id);
      // 既存のセッションを更新
      callSession.status = 'in-progress';
      callSession.customerId = customer._id;
      callSession.aiConfiguration = {
        companyName: agentSettings.conversationSettings.companyName,
        serviceName: agentSettings.conversationSettings.serviceName,
        representativeName: agentSettings.conversationSettings.representativeName,
        targetDepartment: agentSettings.conversationSettings.targetDepartment
      };
      await callSession.save();
    } else {
      // 新規セッションを作成
      callSession = await CallSession.create({
        customerId: customer._id,
        twilioCallSid: CallSid,
        status: 'in-progress',  // 通話開始時点でin-progressにする
        aiConfiguration: {
          companyName: agentSettings.conversationSettings.companyName,
          serviceName: agentSettings.conversationSettings.serviceName,
          representativeName: agentSettings.conversationSettings.representativeName,
          targetDepartment: agentSettings.conversationSettings.targetDepartment
        }
      });
      console.log('[Incoming Call] New call session created:', callSession._id);
    }
    
    console.log('[Incoming Call] Call session created:', callSession._id);
    
    // WebSocketで通話開始を通知（電話番号を正規化）
    const webSocketService = require('../services/websocket');
    
    // To番号（発信先）を日本国内形式に変換
    let toPhoneNumber = To;
    if (toPhoneNumber.startsWith('+81')) {
      toPhoneNumber = '0' + toPhoneNumber.substring(3);
    }
    
    console.log('[WebSocket] 通話開始通知を送信:', {
      callId: callSession._id.toString(),
      phoneNumber: toPhoneNumber,  // To番号（発信先）を使用
      fromPhone: customer.phone,    // From番号（発信元）も送信
      status: 'in-progress'
    });
    
    webSocketService.broadcastCallEvent('call-status', {
      callId: callSession._id.toString(),
      callSid: CallSid,  // TwilioのCallSidも追加
      phoneNumber: toPhoneNumber,  // To番号（発信先）を使用
      fromPhone: customer.phone,    // From番号（発信元）も送信
      status: 'in-progress',
      timestamp: new Date()
    });
    
    // 会話エンジンを初期化（最初の1回のみ）
    const callIdString = callSession._id.toString();
    if (!conversationEngine.hasConversation(callIdString)) {
      conversationEngine.initializeConversation(callIdString, callSession.aiConfiguration);
    }
    
    // 初期メッセージを即座に生成（データベースアクセスを避ける）
    const { companyName, serviceName, representativeName, targetDepartment } = callSession.aiConfiguration;
    const initialMessage = `お世話になります。${companyName}の${representativeName}と申します。${serviceName}のご案内でお電話しました。本日、${targetDepartment}のご担当者さまはいらっしゃいますでしょうか？`;
    console.log('[Incoming Call] Initial message prepared instantly:', initialMessage);
    
    // 最初の応答を速くする（最大3秒以内）
    console.log('[Incoming Call] Starting initial response immediately...');
    
    // 即座にAIが話し始める設定
    const gather = twiml.gather({
      input: 'speech',
      language: 'ja-JP',
      speechTimeout: 'auto',  // 自動検出
      timeout: 3,  // 3秒でタイムアウト（電話がつながって3秒以内に話す）
      action: `${process.env.BASE_URL}/api/twilio/voice/gather/${callSession._id}?isFirst=true`,
      method: 'POST',
      partialResultCallback: `${process.env.BASE_URL}/api/twilio/voice/partial/${callSession._id}`,
      partialResultCallbackMethod: 'POST'
    });
    
    // Gather中は何も言わない（相手の発話を待つ）
    
    // タイムアウト時（3秒無音）はAIが名乗る
    console.log('[Incoming Call] Adding initial message to TwiML...');
    // CoeFontを使用（初期メッセージは即座に準備済み）
    await coefontService.getTwilioPlayElement(twiml, initialMessage);
    
    // 初期メッセージをWebSocketで送信
    webSocketService.sendTranscriptUpdate(callIdString, {
      speaker: 'ai',
      message: initialMessage,
      phoneNumber: toPhoneNumber,
      callId: callIdString,
      timestamp: new Date()
    });
    
    // 名乗った後、相手の応答を待つ
    twiml.redirect({
      method: 'POST'
    }, `${process.env.BASE_URL}/api/twilio/voice/gather/${callSession._id}`);
    
    const twimlString = twiml.toString();
    console.log('[Incoming Call] Sending TwiML response:');
    console.log(twimlString);
    res.type('text/xml').send(twimlString);
    
  } catch (error) {
    return sendErrorResponse('システムエラーが発生しました。申し訳ございません。', error);
  }
});

module.exports = exports;