const express = require('express');
const router = express.Router();
const {
  initiateHandoff,
  getHandoffStatus,
  cancelHandoff,
  updateHandoffSettings,
  getHandoffSettings,
  initiateHandoffByPhone
} = require('../controllers/handoffController');
const { protect } = require('../middlewares/authMiddleware');

// Handoff operations
router.post('/calls/:callId/handoff', protect, initiateHandoff);
router.post('/calls/handoff-by-phone', protect, initiateHandoffByPhone);
router.post('/calls/handoff-by-phone-test', initiateHandoffByPhone); // Test route without auth
router.get('/calls/:callId/handoff-status', protect, getHandoffStatus);
router.delete('/calls/:callId/handoff', protect, cancelHandoff);

// User handoff settings
router.get('/users/handoff-settings', protect, getHandoffSettings);
router.put('/users/handoff-settings', protect, updateHandoffSettings);

module.exports = router;