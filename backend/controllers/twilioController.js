const asyncHandler = require('../middlewares/asyncHandler');
const twilio = require('twilio');
const CallSession = require('../models/CallSession');
const AgentSettings = require('../models/AgentSettings');
const conversationEngine = require('../services/conversationEngine');
const webSocketService = require('../services/websocket');
const coefontService = require('../services/coefontService');

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
  console.log(`[TwiML Conference] Starting call for callId: ${callId}`);
  console.log(`[TwiML Conference] Request body:`, req.body);
  const twiml = new VoiceResponse();

  try {
    // 通話セッションを取得
    const callSession = await CallSession.findById(callId)
      .populate('customerId');

    if (!callSession) {
      await coefontService.getTwilioPlayElement(twiml, 'システムエラーが発生しました。申し訳ございません。');
      twiml.hangup();
      return res.type('text/xml').send(twiml.toString());
    }

    // AI設定から初期メッセージを生成
    let initialMessage;
    try {
      initialMessage = await conversationEngine.generateResponse(callId, 'initial');
      if (!initialMessage) {
        console.error(`[TwiML Conference] WARNING: Empty initial message for callId: ${callId}`);
        initialMessage = 'お世話になります。AIコールシステム株式会社です。営業部のご担当者さまはいらっしゃいますでしょうか？';
      }
    } catch (aiError) {
      console.error(`[TwiML Conference] ERROR generating initial message:`, aiError);
      initialMessage = 'お世話になります。AIコールシステム株式会社です。営業部のご担当者さまはいらっしゃいますでしょうか？';
    }
    console.log(`[TwiML Conference] Initial message: ${initialMessage}`);
    
    // 初期挨拶と最初のGatherを設定
    console.log(`[TwiML Conference] Setting up initial Gather with BASE_URL: ${process.env.BASE_URL}`);
    const gather = twiml.gather({
      input: 'speech',
      language: 'ja-JP',
      speechTimeout: 'auto',  // 自動検出
      timeout: 10,  // 全体のタイムアウトを10秒に
      action: `${process.env.BASE_URL}/api/twilio/voice/gather/${callId}`,
      method: 'POST',
      partialResultCallback: `${process.env.BASE_URL}/api/twilio/voice/partial/${callId}`,
      partialResultCallbackMethod: 'POST'
    });
    await coefontService.getTwilioPlayElement(gather, initialMessage);
    
    // タイムアウト時のフォールバック - 何か話してもらうよう促す
    await coefontService.getTwilioPlayElement(twiml, 'お客様、お聞きになれますか？');
    twiml.redirect({
      method: 'POST'
    }, `${process.env.BASE_URL}/api/twilio/voice/gather/${callId}`);

    // 会話エンジンを初期化
    conversationEngine.initializeConversation(callId, callSession.aiConfiguration);

    res.type('text/xml').send(twiml.toString());
  } catch (error) {
    console.error('Error generating conference TwiML:', error);
    await coefontService.getTwilioPlayElement(twiml, 'システムエラーが発生しました。');
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

  await coefontService.getTwilioPlayElement(twiml, '顧客との通話に接続します。');

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
  const isFirst = req.query.isFirst === 'true';  // 最初の応答かどうか
  
  console.log('============================================');
  console.log('[会話ログ] 顧客の発話を受信');
  console.log(`[会話ログ] CallId: ${callId}`);
  console.log(`[会話ログ] 最初の応答: ${isFirst ? 'はい' : 'いいえ'}`);
  console.log(`[会話ログ] 顧客の発話内容: "${SpeechResult || '(無音)'}"`);
  console.log(`[会話ログ] 信頼度: ${Confidence || 'N/A'}`);
  console.log(`[会話ログ] タイムスタンプ: ${new Date().toISOString()}`);
  console.log(`[会話ログ] リクエストBody:`, JSON.stringify(req.body, null, 2));
  console.log('============================================');
  const twiml = new VoiceResponse();

  try {
    // CallSessionを取得して会話状態を確認
    const callSession = await CallSession.findById(callId).populate('customerId');
    if (!callSession) {
      console.error(`[Speech Input] CallSession not found for ${callId}`);
      await coefontService.getTwilioPlayElement(twiml, 'システムエラーが発生しました。申し訳ございません。');
      twiml.hangup();
      return res.type('text/xml').send(twiml.toString());
    }
    
    // 会話エンジンの状態を確認し、必要なら初期化（初回のみ）
    if (!conversationEngine.hasConversation(callId)) {
      console.log(`[Speech Input] Initializing conversation for ${callId}`);
      conversationEngine.initializeConversation(callId, callSession.aiConfiguration);
    } else {
      console.log(`[Speech Input] Conversation already exists for ${callId}`);
    }
    
    // 無音や無入力の場合の処理
    if (!SpeechResult || SpeechResult.trim() === '') {
      // 最初の無音（2秒待った後）の場合、AIが名乗る
      if (isFirst) {
        console.log(`[Speech Input] First silence detected - AI will introduce itself`);
        const initialMessage = await conversationEngine.generateResponse(callId, 'initial');
        
        const gather = twiml.gather({
          input: 'speech',
          language: 'ja-JP',
          speechTimeout: 'auto',
          timeout: 10,
          action: `${process.env.BASE_URL}/api/twilio/voice/gather/${callId}`,
          method: 'POST',
          partialResultCallback: `${process.env.BASE_URL}/api/twilio/voice/partial/${callId}`,
          partialResultCallbackMethod: 'POST'
        });
        // CoeFontを使用
        await coefontService.getTwilioPlayElement(gather, initialMessage);
        
        // タイムアウト時のフォールバック
        twiml.redirect({
          method: 'POST'
        }, `${process.env.BASE_URL}/api/twilio/voice/gather/${callId}`);
        
        return res.type('text/xml').send(twiml.toString());
      }
      
      // 会話状態を確認して無音カウントを更新
      conversationEngine.updateConversationState(callId, { 
        continuousSilentCount: (conversationEngine.getConversationState(callId)?.continuousSilentCount || 0) + 1 
      });
      const silentCount = conversationEngine.getConversationState(callId)?.continuousSilentCount || 1;
      
      console.log(`[Speech Input] Silence detected (count: ${silentCount}) for call ${callId}`);
      
      // 初回の無音はただ待つ（相手が考えている可能性）
      if (silentCount === 1) {
        console.log(`[Speech Input] First silence - waiting for customer response`);
        const gather = twiml.gather({
          input: 'speech',
          language: 'ja-JP',
          speechTimeout: 3,  // 3秒待つ
          timeout: 5,
          action: `${process.env.BASE_URL}/api/twilio/voice/gather/${callId}`,
          method: 'POST',
          partialResultCallback: `${process.env.BASE_URL}/api/twilio/voice/partial/${callId}`,
          partialResultCallbackMethod: 'POST'
        });
        // 何も言わずに待つ
        
        // タイムアウト後の処理
        twiml.redirect({
          method: 'POST'
        }, `${process.env.BASE_URL}/api/twilio/voice/gather/${callId}`);
        
        return res.type('text/xml').send(twiml.toString());
      }
      
      // 2回目の無音は確認メッセージ
      if (silentCount === 2) {
        console.log(`[Speech Input] Second silence - checking if customer is there`);
        const gather = twiml.gather({
          input: 'speech',
          language: 'ja-JP',
          speechTimeout: 'auto',
          timeout: 10,
          action: `${process.env.BASE_URL}/api/twilio/voice/gather/${callId}`,
          method: 'POST',
          partialResultCallback: `${process.env.BASE_URL}/api/twilio/voice/partial/${callId}`,
          partialResultCallbackMethod: 'POST'
        });
        // CoeFontを使用
        await coefontService.getTwilioPlayElement(gather, 'お客様、お聞きになれますか？');
        
        twiml.redirect({
          method: 'POST'
        }, `${process.env.BASE_URL}/api/twilio/voice/gather/${callId}`);
        
        return res.type('text/xml').send(twiml.toString());
      }
      
      // 3回以上の無音は終話
      if (silentCount >= 3) {
        console.log(`[Speech Input] Too many silences - ending call`);
        // CoeFontを使用
        await coefontService.getTwilioPlayElement(twiml, 'お電話が遠いようですので、また改めてお電話させていただきます。失礼いたします。');
        twiml.hangup();
        return res.type('text/xml').send(twiml.toString());
      }
    }
    
    // 音声入力があったので無音カウントをリセット
    conversationEngine.updateConversationState(callId, { continuousSilentCount: 0 });
    
    // 最初の応答で相手が名乗った場合
    if (isFirst) {
      console.log(`[Speech Input] Customer spoke first: "${SpeechResult}"`);
      // 会話状態を「顧客が先に名乗った」と記録
      conversationEngine.updateConversationState(callId, { customerSpokeFirst: true });
    }
    // 音声認識結果を分類
    const classification = conversationEngine.classifyResponse(SpeechResult, callId);
    console.log(`[Speech Input] Classification result:`, classification);

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

    // WebSocketで文字起こしを送信（電話番号も含める）
    // To番号（発信先）を取得して日本国内形式に変換
    let toPhoneNumber = req.body.To || '';
    if (toPhoneNumber.startsWith('+81')) {
      toPhoneNumber = '0' + toPhoneNumber.substring(3);
    }
    
    // From番号（発信元）を取得して日本国内形式に変換
    let fromPhoneNumber = req.body.From || '';
    if (fromPhoneNumber.startsWith('+1')) {
      fromPhoneNumber = fromPhoneNumber; // 米国番号はそのまま
    }
    
    webSocketService.sendTranscriptUpdate(callId, {
      speaker: 'customer',
      message: SpeechResult,
      phoneNumber: toPhoneNumber,  // To番号（発信先）を使用
      fromPhone: callSession?.customerId?.phone || fromPhoneNumber || '不明',  // CallSessionから顧客情報取得
      callId: callId,
      timestamp: new Date()
    });

    // 引き継ぎが必要な場合
    if (classification.shouldHandoff) {
      // 引き継ぎメッセージを再生
      const handoffMessage = await conversationEngine.generateResponse(callId, 'handoff_message');
      await coefontService.getTwilioPlayElement(twiml, handoffMessage);
      
      // 引き継ぎ処理をトリガー
      await triggerHandoff(callId, classification.intent);
      
      // 保留音楽を再生
      twiml.play({ loop: 0 }, 'http://twimlets.com/holdmusic?Bucket=com.twilio.music.classical');
    } else {
      // AI応答を生成
      let aiResponse;
      try {
        console.log(`[Speech Input] Generating AI response for callId: ${callId}, intent: ${classification.intent}`);
        aiResponse = await conversationEngine.generateResponse(callId, classification.intent);
        
        if (!aiResponse) {
          console.error(`[Speech Input] WARNING: Empty AI response for callId: ${callId}, intent: ${classification.intent}`);
          // デフォルトの応答を生成
          if (isFirst) {
            // 最初の応答の場合は必ず挨拶を返す
            const callSession = await CallSession.findById(callId);
            if (callSession && callSession.aiConfiguration) {
              const { companyName, serviceName, representativeName, targetDepartment } = callSession.aiConfiguration;
              aiResponse = `お世話になります。${companyName}の${representativeName}と申します。${serviceName}のご案内でお電話しました。本日、${targetDepartment}のご担当者さまはいらっしゃいますでしょうか？`;
            } else {
              aiResponse = 'お世話になります。本日はサービスのご案内でお電話させていただきました。ご担当者様はいらっしゃいますでしょうか？';
            }
          } else {
            aiResponse = '申し訳ございません。もう一度お聞きしてもよろしいでしょうか？';
          }
        }
      } catch (aiError) {
        console.error(`[Speech Input] ERROR generating AI response:`, aiError);
        console.error(`[Speech Input] Error stack:`, aiError.stack);
        console.error(`[Speech Input] Error details:`, {
          callId,
          intent: classification.intent,
          isFirst,
          speechResult: SpeechResult
        });
        
        // エラーでも最初の応答は必ず返す
        if (isFirst) {
          const callSession = await CallSession.findById(callId);
          if (callSession && callSession.aiConfiguration) {
            const { companyName, serviceName, representativeName, targetDepartment } = callSession.aiConfiguration;
            aiResponse = `お世話になります。${companyName}の${representativeName}と申します。${serviceName}のご案内でお電話しました。本日、${targetDepartment}のご担当者さまはいらっしゃいますでしょうか？`;
          } else {
            aiResponse = 'お世話になります。本日はサービスのご案内でお電話させていただきました。ご担当者様はいらっしゃいますでしょうか？';
          }
        } else {
          aiResponse = 'お聞き取りできませんでした。もう一度お願いできますでしょうか？';
        }
      }
      console.log('============================================');
      console.log('[会話ログ] AIの応答');
      console.log(`[会話ログ] CallId: ${callId}`);
      console.log(`[会話ログ] AIの応答内容: "${aiResponse}"`);
      console.log(`[会話ログ] 分類されたインテント: ${classification.intent}`);
      console.log(`[会話ログ] 次のアクション: ${classification.nextAction}`);
      console.log(`[会話ログ] タイムスタンプ: ${new Date().toISOString()}`);
      console.log('============================================');
      
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

      // WebSocketで文字起こしを送信（電話番号も含める）
      // To番号（発信先）を取得して日本国内形式に変換
      let toPhoneNumber = req.body.To || '';
      if (toPhoneNumber.startsWith('+81')) {
        toPhoneNumber = '0' + toPhoneNumber.substring(3);
      }
      
      // From番号（発信元）を取得して日本国内形式に変換
      let fromPhoneNumber = req.body.From || '';
      if (fromPhoneNumber.startsWith('+1')) {
        fromPhoneNumber = fromPhoneNumber; // 米国番号はそのまま
      }
      
      webSocketService.sendTranscriptUpdate(callId, {
        speaker: 'ai',
        message: aiResponse,
        phoneNumber: toPhoneNumber,  // To番号（発信先）を使用
        fromPhone: callSession?.customerId?.phone || fromPhoneNumber || '不明',  // CallSessionから顧客情報取得
        callId: callId,
        timestamp: new Date()
      });

      // 応答を再生して次の入力を待つ
      if (classification.nextAction === 'end_call') {
        console.log('[Speech Input] ENDING CALL based on classification');
        await coefontService.getTwilioPlayElement(twiml, aiResponse);
        twiml.hangup();
      } else {
        console.log('[Speech Input] CONTINUING CONVERSATION - Setting up next Gather');
        console.log(`[Speech Input] Setting up next Gather for continuous conversation`);
        console.log(`[Speech Input] Gather action URL: ${process.env.BASE_URL}/api/twilio/voice/gather/${callId}`);
        const gather = twiml.gather({
          input: 'speech',
          language: 'ja-JP',
          speechTimeout: 'auto',  // 自動検出で自牨な会話を実現
          timeout: 10,  // 全体のタイムアウトを10秒に
          action: `${process.env.BASE_URL}/api/twilio/voice/gather/${callId}`,
          method: 'POST',
          partialResultCallback: `${process.env.BASE_URL}/api/twilio/voice/partial/${callId}`,
          partialResultCallbackMethod: 'POST'
        });
        await coefontService.getTwilioPlayElement(gather, aiResponse);
        
        // タイムアウト時のフォールバック（無音の場合も会話を継続）
        // CoeFontを使用
        await coefontService.getTwilioPlayElement(twiml, 'お客様、何かご質問はございますか？');
        twiml.redirect({
          method: 'POST'
        }, `${process.env.BASE_URL}/api/twilio/voice/gather/${callId}`);
      }
    }

    res.type('text/xml').send(twiml.toString());
  } catch (error) {
    console.error('Error handling speech input:', error);
    // CoeFontを使用
    await coefontService.getTwilioPlayElement(twiml, '申し訳ございません。システムエラーが発生しました。');
    twiml.hangup();
    res.type('text/xml').send(twiml.toString());
  }
});

// @desc    Handle partial speech results
// @route   POST /api/twilio/voice/partial/:callId
// @access  Public (Twilio webhook)
exports.handlePartialSpeechResult = asyncHandler(async (req, res) => {
  const { callId } = req.params;
  const { UnstableSpeechResult } = req.body;
  
  // 部分的な認識結果もログに出力
  if (UnstableSpeechResult) {
    console.log(`[会話ログ - 部分認識] CallId: ${callId}, 内容: "${UnstableSpeechResult}"`);
    
    // WebSocketで部分的な認識結果を送信
    webSocketService.sendToCallRoom(callId, 'partial-transcript', {
      speaker: 'customer',
      message: UnstableSpeechResult,
      isPartial: true,
      timestamp: new Date()
    });
  }
  
  res.status(200).send('OK');
});

// @desc    Generate TwiML for joining conference
// @route   POST /api/twilio/voice/conference/join/:conferenceName
// @access  Public (Twilio webhook)
exports.joinConference = asyncHandler(async (req, res) => {
  const { conferenceName } = req.params;
  const twiml = new VoiceResponse();

  await coefontService.getTwilioPlayElement(twiml, '会議に接続します。');

  const dial = twiml.dial();
  dial.conference({
    statusCallback: `/api/twilio/conference/events`,
    statusCallbackEvent: 'join leave',
    statusCallbackMethod: 'POST'
  }, conferenceName);

  res.type('text/xml').send(twiml.toString());
});

// @desc    Generate handoff message TwiML
// @route   POST /api/twilio/voice/handoff-message
// @access  Public (Twilio webhook)
exports.generateHandoffMessage = asyncHandler(async (req, res) => {
  const twiml = new VoiceResponse();
  
  await coefontService.getTwilioPlayElement(twiml, '担当者におつなぎいたします。少々お待ちください。');
  
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
      
      // 取次完了をトランスクリプトに通知
      webSocketService.sendTranscriptUpdate(callId, {
        speaker: 'system',
        message: '担当者が接続しました。',
        timestamp: new Date()
      });
    }
    
    // Conferenceの終了時
    if (StatusCallbackEvent === 'end') {
      // 通話終了をトランスクリプトに通知
      webSocketService.sendTranscriptUpdate(callId, {
        speaker: 'system',
        message: '通話が終了しました。',
        timestamp: new Date()
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

// @desc    Generate TwiML for agent joining after handoff
// @route   POST /api/twilio/voice/agent-join/:callId
// @access  Public (Twilio webhook)
exports.agentJoinCall = asyncHandler(async (req, res) => {
  const { callId } = req.params;
  const twiml = new VoiceResponse();

  try {
    console.log(`[AgentJoin] Agent joining call for callId: ${callId}`);
    
    const callSession = await CallSession.findById(callId).populate('customerId');
    if (!callSession) {
      console.error(`[AgentJoin] CallSession not found for ${callId}`);
      twiml.say('システムエラーが発生しました。', { voice: 'Polly.Mizuki', language: 'ja-JP' });
      twiml.hangup();
      return res.type('text/xml').send(twiml.toString());
    }

    console.log(`[AgentJoin] CallSession found:`, {
      id: callSession._id,
      status: callSession.status,
      twilioCallSid: callSession.twilioCallSid,
      customerPhone: callSession.customerId?.phone
    });

    // 担当者に接続メッセージ
    twiml.say('お客様におつなぎします。', { voice: 'Polly.Mizuki', language: 'ja-JP' });
    
    // 顧客の電話にブリッジ接続（シンプルな方法）
    if (callSession.twilioCallSid) {
      console.log(`[AgentJoin] Bridging to customer call ${callSession.twilioCallSid}`);
      
      // ブリッジ通話を作成
      const dial = twiml.dial({
        callerId: process.env.TWILIO_PHONE_NUMBER,
        timeout: 30
      });
      
      // 顧客のCallSidに直接接続
      dial.call(callSession.twilioCallSid);
      
      // CallSessionのステータスを更新
      await CallSession.findByIdAndUpdate(callId, {
        status: 'human-connected',
        'handoffDetails.connectedAt': new Date()
      });

      // WebSocketで通知
      webSocketService.broadcastCallEvent('handoff-connected', {
        callId,
        timestamp: new Date()
      });
    } else {
      console.error(`[AgentJoin] No valid Twilio CallSid for customer`);
      twiml.say('お客様との接続に失敗しました。', { voice: 'Polly.Mizuki', language: 'ja-JP' });
      twiml.hangup();
    }

    console.log(`[AgentJoin] TwiML response sent for agent`);
    res.type('text/xml').send(twiml.toString());
  } catch (error) {
    console.error('[AgentJoin] Error:', error);
    twiml.say('システムエラーが発生しました。', { voice: 'Polly.Mizuki', language: 'ja-JP' });
    twiml.hangup();
    res.type('text/xml').send(twiml.toString());
  }
});

// @desc    Customer joins conference for handoff
// @route   POST /api/twilio/voice/customer-join-conference/:callId
// @access  Public (Twilio webhook)
exports.customerJoinConference = asyncHandler(async (req, res) => {
  const { callId } = req.params;
  const twiml = new VoiceResponse();

  try {
    console.log(`[CustomerJoin] Customer joining conference for callId: ${callId}`);
    
    const conferenceName = `handoff-${callId}`;
    
    // 顧客をConferenceに参加させる
    const dial = twiml.dial();
    dial.conference({
      startConferenceOnEnter: false,  // 顧客が参加しても会議を開始しない（担当者を待つ）
      endConferenceOnExit: false,  // 顧客が退出しても会議を終了しない
      beep: false,  // ビープ音なし
      statusCallback: `${process.env.BASE_URL}/api/twilio/conference/customer-status/${callId}`,
      statusCallbackEvent: 'join leave',
      statusCallbackMethod: 'POST'
    }, conferenceName);

    console.log(`[CustomerJoin] TwiML response sent for customer`);
    res.type('text/xml').send(twiml.toString());
  } catch (error) {
    console.error('[CustomerJoin] Error:', error);
    twiml.say('システムエラーが発生しました。', { voice: 'Polly.Mizuki', language: 'ja-JP' });
    twiml.hangup();
    res.type('text/xml').send(twiml.toString());
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

// @desc    Generate TwiML for agent joining conference after handoff
// @route   POST /api/twilio/voice/agent-join/:callId
// @access  Public (Twilio webhook)
exports.agentJoinHandoff = asyncHandler(async (req, res) => {
  const { callId } = req.params;
  const twiml = new VoiceResponse();

  try {
    const callSession = await CallSession.findById(callId);
    if (!callSession) {
      await coefontService.getTwilioPlayElement(twiml, 'システムエラーが発生しました。');
      twiml.hangup();
      return res.type('text/xml').send(twiml.toString());
    }

    const conferenceName = `call-${callId}`;
    
    // 担当者に接続メッセージ
    await coefontService.getTwilioPlayElement(twiml, 'お客様におつなぎします。');
    
    // Conference に参加
    const dial = twiml.dial();
    dial.conference({
      startConferenceOnEnter: false,  // 既に Conference は開始済み
      endConferenceOnExit: true,  // 担当者が切ったら終了
      statusCallback: `${process.env.BASE_URL}/api/twilio/conference/agent-events/${callId}`,
      statusCallbackEvent: 'join leave',
      statusCallbackMethod: 'POST'
    }, conferenceName);

    res.type('text/xml').send(twiml.toString());
  } catch (error) {
    console.error('Error in agentJoinHandoff:', error);
    await coefontService.getTwilioPlayElement(twiml, 'システムエラーが発生しました。');
    twiml.hangup();
    res.type('text/xml').send(twiml.toString());
  }
});

// @desc    Generate TwiML for AI bot joining conference
// @route   POST /api/twilio/voice/ai-bot/:callId
// @access  Public (Twilio webhook)
exports.aiJoinConference = asyncHandler(async (req, res) => {
  const { callId } = req.params;
  const twiml = new VoiceResponse();

  try {
    const callSession = await CallSession.findById(callId)
      .populate('customerId');

    if (!callSession) {
      twiml.hangup();
      return res.type('text/xml').send(twiml.toString());
    }

    const conferenceName = `call-${callId}`;
    
    // Conference に参加してAI応答を開始
    const dial = twiml.dial();
    dial.conference({
      startConferenceOnEnter: false,
      endConferenceOnExit: false,
      statusCallback: `${process.env.BASE_URL}/api/twilio/conference/ai-events/${callId}`,
      statusCallbackEvent: 'join leave mute',
      statusCallbackMethod: 'POST'
    }, conferenceName);
    
    // その後 AI 応答ループに入る
    twiml.redirect({
      method: 'POST'
    }, `${process.env.BASE_URL}/api/twilio/voice/gather/${callId}?isFirst=true`);

    res.type('text/xml').send(twiml.toString());
  } catch (error) {
    console.error('Error in aiJoinConference:', error);
    twiml.hangup();
    res.type('text/xml').send(twiml.toString());
  }
});

// @desc    Generate wait music for conference
// @route   POST /api/twilio/voice/wait/:callId
// @access  Public (Twilio webhook)
exports.generateWaitMusic = asyncHandler(async (req, res) => {
  const twiml = new VoiceResponse();
  
  // Conference 待機中の音楽
  twiml.play({ loop: 0 }, 'http://twimlets.com/holdmusic?Bucket=com.twilio.music.classical');
  
  res.type('text/xml').send(twiml.toString());
});

// @desc    Handle conference agent events
// @route   POST /api/twilio/conference/agent-events/:callId
// @access  Public (Twilio webhook)
exports.handleAgentConferenceEvents = asyncHandler(async (req, res) => {
  const { callId } = req.params;
  const { StatusCallbackEvent, CallSid } = req.body;

  try {
    if (StatusCallbackEvent === 'participant-join') {
      // 担当者が参加したらAIを削除
      const callSession = await CallSession.findById(callId);
      const conferenceName = `call-${callId}`;
      
      // AIの Conference 参加者を見つけて削除
      const participants = await client
        .conferences(conferenceName)
        .participants
        .list();
      
      const aiParticipant = callSession.participants.find(p => p.type === 'ai');
      if (aiParticipant) {
        const aiConferenceParticipant = participants.find(p => p.callSid === aiParticipant.callSid);
        if (aiConferenceParticipant) {
          await client
            .conferences(conferenceName)
            .participants(aiConferenceParticipant.callSid)
            .remove();
        }
      }
      
      // 顧客の保留を解除
      const customerParticipant = callSession.participants.find(p => p.type === 'customer');
      if (customerParticipant && customerParticipant.callSid) {
        await client.calls(customerParticipant.callSid).update({
          twiml: `<Response><Say voice="Polly.Mizuki" language="ja-JP">担当者におつなぎしました。</Say></Response>`
        });
      }
      
      // ステータスを更新
      await CallSession.findByIdAndUpdate(callId, {
        status: 'human-connected',
        'handoffDetails.connectedAt': new Date(),
        $push: {
          participants: {
            type: 'agent',
            callSid: CallSid,
            joinedAt: new Date(),
            isMuted: false,
            isOnHold: false
          }
        }
      });
      
      // WebSocket通知
      webSocketService.broadcastCallEvent('handoff-connected', {
        callId,
        agentCallSid: CallSid,
        timestamp: new Date()
      });
    }
    
    if (StatusCallbackEvent === 'participant-leave') {
      // 担当者が退出したら通話終了
      await CallSession.findByIdAndUpdate(callId, {
        status: 'completed',
        endTime: new Date(),
        'handoffDetails.disconnectedAt': new Date()
      });
      
      // Conference を終了
      const conferenceName = `call-${callId}`;
      try {
        await client.conferences(conferenceName).update({ status: 'completed' });
      } catch (error) {
        console.error('Failed to end conference:', error);
      }
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error handling agent conference event:', error);
    res.status(500).send('Error');
  }
});

module.exports = exports;