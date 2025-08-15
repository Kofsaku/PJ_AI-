const express = require('express');
const router = express.Router();
const {
  generateConferenceTwiML,
  agentJoinConference,
  handleSpeechInput,
  generateHandoffMessage,
  handleConferenceEvents,
  handleCallStatus,
  handleRecordingStatus
} = require('../controllers/twilioController');

// TwiML generation endpoints
router.post('/voice/conference/:callId', generateConferenceTwiML);
router.post('/voice/conference/agent/:conferenceName', agentJoinConference);
router.post('/voice/gather/:callId', handleSpeechInput);
router.post('/voice/handoff-message', generateHandoffMessage);

// Webhook endpoints
router.post('/conference/events/:callId', handleConferenceEvents);
router.post('/call/status/:callId', handleCallStatus);
router.post('/recording/status/:callId', handleRecordingStatus);

// Additional webhook for agent call status
router.post('/call/agent-status/:callId', async (req, res) => {
  const { CallStatus, CallSid } = req.body;
  console.log(`Agent call status: ${CallStatus} for call ${CallSid}`);
  res.status(200).send('OK');
});

module.exports = router;