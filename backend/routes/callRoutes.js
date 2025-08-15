const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const {
  startCall,
  getActiveCalls,
  handoffCall,
  endCall,
  getCallHistory,
  getCallDetails,
  updateTranscript,
  getCallStatistics
} = require('../controllers/callController');

// All routes require authentication
router.use(protect);

// Call management
router.post('/start', startCall);
router.get('/active', getActiveCalls);
router.get('/history', getCallHistory);
router.get('/statistics', getCallStatistics);

// Specific call operations
router.route('/:callId')
  .get(getCallDetails);

router.post('/:callId/handoff', handoffCall);
router.post('/:callId/end', endCall);
router.put('/:callId/transcript', updateTranscript);

module.exports = router;