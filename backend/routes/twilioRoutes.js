const express = require('express');
const router = express.Router();
const {
  generateConferenceTwiML,
  agentJoinConference,
  handleSpeechInput,
  handlePartialSpeechResult,
  joinConference,
  generateHandoffMessage,
  handleConferenceEvents,
  handleCallStatus,
  handleRecordingStatus,
  agentJoinHandoff,
  aiJoinConference,
  generateWaitMusic,
  handleAgentConferenceEvents,
  agentJoinCall,
  customerJoinConference,
  handleTransferStatus
} = require('../controllers/twilioController');
const { handleIncomingCall } = require('../controllers/twilioVoiceController');

// Main voice endpoint for incoming calls
router.post('/voice', handleIncomingCall);

// TwiML generation endpoints
router.post('/voice/conference/:callId', generateConferenceTwiML);
router.post('/voice/conference/agent/:conferenceName', agentJoinConference);
router.post('/voice/conference/join/:conferenceName', joinConference);
router.post('/voice/gather/:callId', handleSpeechInput);
router.post('/voice/partial/:callId', handlePartialSpeechResult);
router.post('/voice/handoff-message', generateHandoffMessage);

// Webhook endpoints
router.post('/conference/events/:callId', handleConferenceEvents);
router.post('/call/status/:callId', handleCallStatus);
router.post('/recording/status/:callId', handleRecordingStatus);
router.post('/transfer/status/:callId', handleTransferStatus);

// General status endpoint for Twilio callbacks
router.post('/status', async (req, res) => {
  const { CallStatus, CallSid, Direction, From, To, Duration } = req.body;
  console.log(`[Twilio Status] CallSid: ${CallSid}, Status: ${CallStatus}, From: ${From}, To: ${To}`);
  
  try {
    // CallSidからCallSessionを検索
    const CallSession = require('../models/CallSession');
    const Customer = require('../models/Customer');
    const webSocketService = require('../services/websocket');
    const conversationEngine = require('../services/conversationEngine');
    
    const callSession = await CallSession.findOne({ twilioCallSid: CallSid }).populate('customerId');
    
    if (callSession) {
      console.log(`[Twilio Status] Found CallSession: ${callSession._id}`);
      
      const updateData = {};
      let shouldBroadcast = false;
      
      // ステータスに応じて更新
      switch (CallStatus) {
        case 'initiated':
        case 'ringing':
          updateData.status = 'calling';
          shouldBroadcast = true;
          break;
        case 'answered':
        case 'in-progress':
          updateData.status = 'in-progress';
          shouldBroadcast = true;
          break;
        case 'completed':
          updateData.status = 'completed';
          updateData.endTime = new Date();
          if (Duration) {
            updateData.duration = parseInt(Duration);
          }
          // 会話エンジンをクリア
          conversationEngine.clearConversation(callSession._id.toString());
          shouldBroadcast = true;
          
          // 顧客の最終コール日を更新
          if (callSession.customerId?._id) {
            const today = new Date();
            const dateStr = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}`;
            
            await Customer.findByIdAndUpdate(callSession.customerId._id, {
              date: dateStr,
              result: callSession.callResult || '完了'
            });
            
            console.log(`[Twilio Status] Updated customer last call date: ${dateStr} for customer: ${callSession.customerId._id}`);
          }
          break;
        case 'failed':
        case 'busy':
        case 'no-answer':
        case 'canceled':
        case 'cancelled':
          updateData.status = 'failed';
          updateData.endTime = new Date();
          updateData.error = `Call ${CallStatus}`;
          if (Duration) {
            updateData.duration = parseInt(Duration);
          }
          // 会話エンジンをクリア
          conversationEngine.clearConversation(callSession._id.toString());
          shouldBroadcast = true;
          break;
      }
      
      if (Object.keys(updateData).length > 0) {
        await CallSession.findByIdAndUpdate(callSession._id, updateData);
      }
      
      if (shouldBroadcast) {
        // 電話番号を正規化
        let phoneNumber = '';
        if (callSession.customerId?.phone) {
          phoneNumber = callSession.customerId.phone;
        } else {
          phoneNumber = To || From || '';
          if (phoneNumber.startsWith('+81')) {
            phoneNumber = '0' + phoneNumber.substring(3);
          }
        }
        
        console.log(`[Twilio Status] Broadcasting status: ${updateData.status || CallStatus}, Phone: ${phoneNumber}`);
        
        webSocketService.broadcastCallEvent('call-status', {
          callId: callSession._id.toString(),
          callSid: CallSid,
          phoneNumber: phoneNumber,
          status: updateData.status || CallStatus,
          duration: Duration,
          timestamp: new Date()
        });
      }
    } else {
      console.log(`[Twilio Status] No CallSession found for CallSid: ${CallSid}`);
    }
  } catch (error) {
    console.error('[Twilio Status] Error processing status callback:', error);
  }
  
  res.status(200).type('text/xml').send('<Response></Response>');
});

// Additional webhook for agent call status
router.post('/call/agent-status/:callId', async (req, res) => {
  const { CallStatus, CallSid } = req.body;
  console.log(`Agent call status: ${CallStatus} for call ${CallSid}`);
  res.status(200).send('OK');
});

// Handoff related endpoints
router.post('/voice/agent-join/:callId', agentJoinCall);
router.post('/voice/customer-join-conference/:callId', customerJoinConference);
router.post('/voice/ai-bot/:callId', aiJoinConference);
router.post('/voice/wait/:callId', generateWaitMusic);
router.post('/voice/wait-music', (req, res) => {
  const VoiceResponse = require('twilio').twiml.VoiceResponse;
  const twiml = new VoiceResponse();
  twiml.play({ loop: 10 }, 'http://twimlets.com/holdmusic?Bucket=com.twilio.music.classical');
  res.type('text/xml').send(twiml.toString());
});
router.post('/conference/agent-events/:callId', handleAgentConferenceEvents);
router.post('/conference/status/:callId', (req, res) => {
  console.log(`[Conference Status] ${req.params.callId}:`, req.body);
  res.status(200).send('OK');
});
router.post('/conference/customer-status/:callId', (req, res) => {
  console.log(`[Conference Customer Status] ${req.params.callId}:`, req.body);
  res.status(200).send('OK');
});

module.exports = router;