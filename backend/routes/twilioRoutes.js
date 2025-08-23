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
  customerJoinConference
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

// General status endpoint for Twilio callbacks
router.post('/status', (req, res) => {
  const { CallStatus, CallSid, Direction, From, To } = req.body;
  console.log(`[Twilio Status] CallSid: ${CallSid}, Status: ${CallStatus}, From: ${From}, To: ${To}`);
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