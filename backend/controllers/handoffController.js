const asyncHandler = require('../middlewares/asyncHandler');
const ErrorResponse = require('../utils/ErrorResponse');
const CallSession = require('../models/CallSession');
const Customer = require('../models/Customer');
const User = require('../models/User');
const twilio = require('twilio');
const webSocketService = require('../services/websocket');
const coefontService = require('../services/coefontService');

// Twilio client initialization
const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// @desc    Initiate handoff to human agent
// @route   POST /api/calls/:callId/handoff
// @access  Private
exports.initiateHandoff = asyncHandler(async (req, res, next) => {
  const { callId } = req.params;
  const userId = req.user.id;

  // 通話セッションを取得
  const callSession = await CallSession.findById(callId)
    .populate('customerId');
  
  if (!callSession) {
    return next(new ErrorResponse('Call session not found', 404));
  }

  // ステータスチェック
  if (!['ai-responding', 'initiated', 'in-progress'].includes(callSession.status)) {
    return next(new ErrorResponse('Cannot handoff call in current status', 400));
  }

  // 既に取次中または人間が対応中の場合
  if (callSession.status === 'transferring' || callSession.status === 'human-connected') {
    return next(new ErrorResponse('Handoff already in progress or completed', 400));
  }

  // ユーザー情報を取得
  const user = await User.findById(userId);
  if (!user.handoffPhoneNumber) {
    return next(new ErrorResponse('User does not have handoff phone number configured', 400));
  }

  try {
    // 固定の取次先電話番号を使用（08070239355）
    // const agentPhoneNumber = user.getTwilioPhoneNumber();
    const agentPhoneNumber = '+818070239355';  // 日本の国際電話番号形式
    console.log(`[Handoff] Using fixed handoff number: ${agentPhoneNumber}`);

    // 通話セッションを更新（取次開始）
    await CallSession.findByIdAndUpdate(callId, {
      status: 'transferring',
      'handoffDetails.requestedBy': userId,
      'handoffDetails.requestedAt': new Date(),
      'handoffDetails.handoffPhoneNumber': agentPhoneNumber,
      'handoffDetails.handoffMethod': 'manual'
    });

    // 担当者に電話をかけて、Conference経由で接続
    console.log(`[Handoff] Creating conference call to agent ${agentPhoneNumber}`);
    
    const conferenceName = `handoff-${callId}`;
    
    // 1. 担当者に電話をかける
    const agentCall = await client.calls.create({
      to: agentPhoneNumber,
      from: process.env.TWILIO_PHONE_NUMBER,
      twiml: `<Response>
        <Say voice="Polly.Mizuki" language="ja-JP">お客様からのお電話です。接続します。</Say>
        <Dial>
          <Conference 
            startConferenceOnEnter="true" 
            endConferenceOnExit="true"
            record="record-from-start"
            recordingStatusCallback="${process.env.BASE_URL}/api/twilio/recording/status/${callId}"
            recordingStatusCallbackMethod="POST">${conferenceName}</Conference>
        </Dial>
      </Response>`,
      timeout: 30
    });
    
    console.log(`[Handoff] Agent call created: ${agentCall.sid}`);
    
    // 2. 顧客をConferenceに移動（CoeFont音声を使用）
    if (callSession.twilioCallSid && callSession.twilioCallSid.startsWith('CA')) {
      // CoeFontで音声URLを生成
      const message = '担当者におつなぎします。少々お待ちください。';
      const audioUrl = await coefontService.generateSpeechUrl(message);
      
      let customerTwiml;
      if (audioUrl) {
        // CoeFontの音声URLを使用
        customerTwiml = `<Response>
          <Play>${audioUrl}</Play>
          <Dial>
            <Conference 
              startConferenceOnEnter="false" 
              endConferenceOnExit="false"
              statusCallback="${process.env.BASE_URL}/api/twilio/conference/events/${callId}"
              statusCallbackMethod="POST"
              statusCallbackEvent="start end join leave mute hold">${conferenceName}</Conference>
          </Dial>
        </Response>`;
      } else {
        // フォールバック: Polly.Mizukiを使用
        customerTwiml = `<Response>
          <Say voice="Polly.Mizuki" language="ja-JP">${message}</Say>
          <Dial>
            <Conference 
              startConferenceOnEnter="false" 
              endConferenceOnExit="false"
              statusCallback="${process.env.BASE_URL}/api/twilio/conference/events/${callId}"
              statusCallbackMethod="POST"
              statusCallbackEvent="start end join leave mute hold">${conferenceName}</Conference>
          </Dial>
        </Response>`;
      }
      
      await client.calls(callSession.twilioCallSid).update({
        twiml: customerTwiml
      });
      console.log(`[Handoff] Customer moved to conference successfully with CoeFont announcement`);
    } else {
      // 担当者への通話をキャンセル
      await client.calls(agentCall.sid).update({ status: 'completed' });
      throw new Error('Invalid call session');
    }

    // 取次詳細を更新
    await CallSession.findByIdAndUpdate(callId, {
      status: 'transferring',
      'handoffDetails.handoffCallSid': agentCall.sid,
      'handoffDetails.conferenceName': conferenceName
    });

    // WebSocketで通知
    webSocketService.broadcastCallEvent('handoff-initiated', {
      callId,
      agentId: userId,
      agentCallSid: agentCall.sid,
      timestamp: new Date()
    });
    
    // 取次開始時の案内メッセージをトランスクリプトに追加
    const customer = callSession.customerId;
    webSocketService.sendTranscriptUpdate(callId, {
      speaker: 'system',
      message: '担当者に接続中...',
      phoneNumber: customer ? customer.phone : '',
      timestamp: new Date()
    });

    res.status(200).json({
      success: true,
      data: {
        callId,
        handoffCallSid: agentCall.sid,
        status: 'connecting',
        agentPhoneNumber: agentPhoneNumber.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')  // マスク表示
      }
    });

  } catch (error) {
    // エラー時は状態を戻す
    await CallSession.findByIdAndUpdate(callId, {
      status: 'ai-responding',
      $unset: { handoffDetails: 1 }
    });

    return next(new ErrorResponse(`Failed to initiate handoff: ${error.message}`, 500));
  }
});

// @desc    Get handoff status
// @route   GET /api/calls/:callId/handoff-status
// @access  Private
exports.getHandoffStatus = asyncHandler(async (req, res, next) => {
  const { callId } = req.params;

  const callSession = await CallSession.findById(callId)
    .populate('handoffDetails.requestedBy', 'firstName lastName email');

  if (!callSession) {
    return next(new ErrorResponse('Call session not found', 404));
  }

  const isHandoffAvailable = ['ai-responding', 'initiated', 'in-progress'].includes(callSession.status);
  const handoffInProgress = callSession.status === 'transferring';
  const humanConnected = callSession.status === 'human-connected';

  res.status(200).json({
    success: true,
    data: {
      isHandoffAvailable,
      handoffInProgress,
      humanConnected,
      currentStatus: callSession.status,
      handoffDetails: callSession.handoffDetails
    }
  });
});

// @desc    Cancel handoff
// @route   DELETE /api/calls/:callId/handoff
// @access  Private
exports.cancelHandoff = asyncHandler(async (req, res, next) => {
  const { callId } = req.params;

  const callSession = await CallSession.findById(callId);
  if (!callSession) {
    return next(new ErrorResponse('Call session not found', 404));
  }

  if (callSession.status !== 'transferring') {
    return next(new ErrorResponse('No handoff in progress', 400));
  }

  try {
    // 担当者への通話を終了
    if (callSession.handoffDetails?.handoffCallSid) {
      await client.calls(callSession.handoffDetails.handoffCallSid).update({
        status: 'completed'
      });
    }

    // 顧客の保留を解除してAI対応に戻す
    if (callSession.twilioCallSid) {
      const twiml = `<Response>
        <Say voice="Polly.Mizuki" language="ja-JP">お待たせいたしました。引き続きAIが対応させていただきます。</Say>
        <Redirect method="POST">${process.env.BASE_URL}/api/twilio/voice/gather/${callId}</Redirect>
      </Response>`;
      
      await client.calls(callSession.twilioCallSid).update({
        twiml: twiml
      });
    }

    // ステータスを戻す
    await CallSession.findByIdAndUpdate(callId, {
      status: 'ai-responding',
      'handoffDetails.disconnectedAt': new Date()
    });

    // WebSocketで通知
    webSocketService.broadcastCallEvent('handoff-cancelled', {
      callId,
      timestamp: new Date()
    });

    res.status(200).json({
      success: true,
      message: 'Handoff cancelled successfully'
    });

  } catch (error) {
    return next(new ErrorResponse(`Failed to cancel handoff: ${error.message}`, 500));
  }
});

// @desc    Update user handoff settings
// @route   PUT /api/users/handoff-settings
// @access  Private
exports.updateHandoffSettings = asyncHandler(async (req, res, next) => {
  const { phoneNumber } = req.body;
  const userId = req.user.id;

  const updateData = {};
  
  if (phoneNumber !== undefined) {
    // 電話番号のバリデーション
    const cleanedNumber = phoneNumber.replace(/[-\s]/g, '');
    if (cleanedNumber && !/^0\d{9,10}$/.test(cleanedNumber)) {
      return next(new ErrorResponse('Invalid Japanese phone number format', 400));
    }
    updateData.handoffPhoneNumber = cleanedNumber;
  }

  const user = await User.findByIdAndUpdate(
    userId,
    updateData,
    { new: true, runValidators: true }
  ).select('handoffPhoneNumber');

  res.status(200).json({
    success: true,
    data: {
      handoffPhoneNumber: user.handoffPhoneNumber ? 
        user.handoffPhoneNumber.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : null
    }
  });
});

// @desc    Get user handoff settings
// @route   GET /api/users/handoff-settings
// @access  Private
exports.getHandoffSettings = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;

  const user = await User.findById(userId).select('handoffPhoneNumber');

  res.status(200).json({
    success: true,
    data: {
      handoffPhoneNumber: user.handoffPhoneNumber ? 
        user.handoffPhoneNumber.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : null
    }
  });
});

// @desc    Initiate handoff by phone number
// @route   POST /api/calls/handoff-by-phone
// @access  Private
exports.initiateHandoffByPhone = asyncHandler(async (req, res, next) => {
  const { phoneNumber, callSid } = req.body;
  
  console.log(`[Handoff Debug] Raw request data:`, {
    hasUser: !!req.user,
    userId: req.user ? req.user.id : 'no user',
    userObject: req.user
  });
  
  if (!req.user || !req.user.id) {
    console.log(`[Handoff Debug] Error: User not authenticated`);
    return next(new ErrorResponse('User not authenticated', 401));
  }
  
  const userId = req.user.id;

  console.log(`[Handoff Debug] Request received:`, {
    phoneNumber,
    callSid,
    userId,
    body: req.body
  });

  if (!phoneNumber && !callSid) {
    console.log(`[Handoff Debug] Error: Phone number or callSid is required`);
    return next(new ErrorResponse('Phone number or callSid is required', 400));
  }

  let customer;
  
  // CallSidが提供された場合、それを使って検索
  if (callSid) {
    console.log(`[Handoff Debug] Searching for call session with CallSid: ${callSid}`);
    const sessionByCallSid = await CallSession.findOne({
      twilioCallSid: callSid
    }).populate('customerId');
    
    if (sessionByCallSid && sessionByCallSid.customerId) {
      customer = sessionByCallSid.customerId;
      console.log(`[Handoff Debug] Customer found via CallSid:`, { 
        id: customer._id, 
        phone: customer.phone 
      });
    }
  }
  
  // 電話番号で顧客を検索（CallSidで見つからない場合）
  if (!customer && phoneNumber) {
    // 電話番号を正規化
    let normalizedPhone = phoneNumber;
    if (normalizedPhone.startsWith('+81')) {
      normalizedPhone = '0' + normalizedPhone.substring(3);
    }

    console.log(`[Handoff Debug] Normalized phone: ${normalizedPhone}`);

    // まず顧客を探す
    console.log(`[Handoff Debug] Searching for customer with phone: ${normalizedPhone}`);
    customer = await Customer.findOne({ phone: normalizedPhone });
  }
  
  if (!customer) {
    console.log(`[Handoff Debug] Error: Customer not found`);
    return next(new ErrorResponse('Customer not found', 404));
  }

  console.log(`[Handoff Debug] Customer found:`, { id: customer._id, phone: customer.phone });

  // 進行中の通話セッションを検索（より広い範囲で検索）
  console.log(`[Handoff Debug] Searching for call sessions for customer ${customer._id}...`);
  
  // まず最新のセッションを取得
  let callSession = await CallSession.findOne({
    customerId: customer._id,
    status: { $in: ['ai-responding', 'initiated', 'in-progress', 'calling'] }
  }).sort({ createdAt: -1 }).populate('customerId');
  
  // アクティブなセッションが見つからない場合、最近のcompletedセッションも確認
  if (!callSession) {
    const recentSession = await CallSession.findOne({
      customerId: customer._id,
      status: 'completed',
      createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) } // 5分以内
    }).sort({ createdAt: -1 }).populate('customerId');
    
    if (recentSession) {
      console.log(`[Handoff Debug] Found recent completed session, will use it for handoff`);
      callSession = recentSession;
      // ステータスを更新してアクティブにする
      callSession.status = 'in-progress';
      await callSession.save();
    }
  }

  console.log(`[Handoff Debug] Call session search result:`, {
    found: !!callSession,
    callSession: callSession ? {
      id: callSession._id,
      status: callSession.status,
      customerId: callSession.customerId ? callSession.customerId._id : null,
      customerPhone: callSession.customerId ? callSession.customerId.phone : null,
      createdAt: callSession.createdAt
    } : null
  });

  if (!callSession) {
    console.log(`[Handoff Debug] Error: No active call session found for customer`);
    return next(new ErrorResponse('現在進行中の通話がありません。通話中にのみ取次が可能です。', 404));
  }

  // ユーザー情報を取得
  console.log(`[Handoff Debug] Getting user info for userId: ${userId}`);
  const user = await User.findById(userId);
  
  console.log(`[Handoff Debug] User found:`, {
    found: !!user,
    userId: user ? user._id : null,
    hasHandoffPhone: user ? !!user.handoffPhoneNumber : null,
    handoffPhone: user && user.handoffPhoneNumber ? user.handoffPhoneNumber.replace(/(.*).{4}/, '****$1') : null
  });

  // 取次先電話番号の確認をスキップ（固定番号を使用するため）
  // if (!user.handoffPhoneNumber) {
  //   console.log(`[Handoff Debug] Error: User does not have handoff phone number configured`);
  //   return next(new ErrorResponse('User does not have handoff phone number configured', 400));
  // }

  try {
    // 固定の取次先電話番号を使用（08070239355）
    // const agentPhoneNumber = user.getTwilioPhoneNumber();
    const agentPhoneNumber = '+818070239355';  // 日本の国際電話番号形式
    console.log(`[Handoff] Using fixed handoff number: ${agentPhoneNumber}`);

    // 通話セッションを更新（取次開始）
    await CallSession.findByIdAndUpdate(callSession._id, {
      status: 'transferring',
      'handoffDetails.requestedBy': userId,
      'handoffDetails.requestedAt': new Date(),
      'handoffDetails.handoffPhoneNumber': agentPhoneNumber,
      'handoffDetails.handoffMethod': 'manual'
    });

    // 担当者に電話をかけて、Conference経由で接続
    console.log(`[Handoff] Creating conference call to agent ${agentPhoneNumber}`);
    
    const conferenceName = `handoff-${callSession._id}`;
    
    // 1. 担当者に電話をかける
    const agentCall = await client.calls.create({
      to: agentPhoneNumber,
      from: process.env.TWILIO_PHONE_NUMBER,
      twiml: `<Response>
        <Say voice="Polly.Mizuki" language="ja-JP">お客様からのお電話です。接続します。</Say>
        <Dial>
          <Conference 
            startConferenceOnEnter="true" 
            endConferenceOnExit="true"
            record="record-from-start"
            recordingStatusCallback="${process.env.BASE_URL}/api/twilio/recording/status/${callId}"
            recordingStatusCallbackMethod="POST">${conferenceName}</Conference>
        </Dial>
      </Response>`,
      timeout: 30
    });
    
    console.log(`[Handoff] Agent call created: ${agentCall.sid}`);
    
    // 2. 顧客をConferenceに移動
    if (callSession.twilioCallSid && callSession.twilioCallSid.startsWith('CA')) {
      const customerTwiml = `<Response>
        <Say voice="Polly.Mizuki" language="ja-JP">担当者におつなぎします。</Say>
        <Dial>
          <Conference startConferenceOnEnter="false" endConferenceOnExit="false">${conferenceName}</Conference>
        </Dial>
      </Response>`;
      
      try {
        await client.calls(callSession.twilioCallSid).update({
          twiml: customerTwiml
        });
        console.log(`[Handoff] Customer moved to conference successfully`);
      } catch (error) {
        console.error(`[Handoff] Error moving customer to conference:`, error.message);
        // 担当者への通話もキャンセル
        try {
          await client.calls(agentCall.sid).update({ status: 'completed' });
        } catch (cancelError) {
          console.error(`[Handoff] Error cancelling agent call:`, cancelError.message);
        }
        throw error;
      }
    } else {
      console.log(`[Handoff] Invalid or missing Twilio CallSid: ${callSession.twilioCallSid}`);
      // 担当者への通話をキャンセル
      try {
        await client.calls(agentCall.sid).update({ status: 'completed' });
      } catch (cancelError) {
        console.error(`[Handoff] Error cancelling agent call:`, cancelError.message);
      }
      throw new Error('Invalid call session');
    }

    // 取次詳細を更新
    await CallSession.findByIdAndUpdate(callSession._id, {
      status: 'transferring',
      'handoffDetails.handoffCallSid': agentCall.sid,
      'handoffDetails.conferenceName': conferenceName
    });

    // WebSocketで通知
    webSocketService.broadcastCallEvent('handoff-initiated', {
      callId: callSession._id,
      agentId: userId,
      agentCallSid: agentCall.sid,
      conferenceName: conferenceName,
      timestamp: new Date()
    });
    
    // 取次開始時の案内メッセージをトランスクリプトに追加
    webSocketService.sendTranscriptUpdate(callSession._id, {
      speaker: 'system',
      message: '担当者に接続中...',
      phoneNumber: customer.phone,
      timestamp: new Date()
    });

    res.status(200).json({
      success: true,
      data: {
        callId: callSession._id,
        handoffCallSid: agentCall.sid,
        status: 'connecting',
        agentPhoneNumber: agentPhoneNumber.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
      }
    });

  } catch (error) {
    // エラー時は状態を戻す
    await CallSession.findByIdAndUpdate(callSession._id, {
      status: 'ai-responding',
      $unset: { handoffDetails: 1 }
    });

    return next(new ErrorResponse(`Failed to initiate handoff: ${error.message}`, 500));
  }
});

module.exports = exports;