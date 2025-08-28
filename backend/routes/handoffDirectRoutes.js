// Direct handoff routes without authentication for development
const express = require('express');
const router = express.Router();
const { initiateHandoffByPhone, initiateHandoff } = require('../controllers/handoffController');

// Direct route without any middleware - GUARANTEED TO WORK
router.post('/handoff-direct', (req, res, next) => {
  console.log('[Handoff Direct] ========== NEW HANDOFF REQUEST ==========');
  console.log('[Handoff Direct] Request body:', JSON.stringify(req.body, null, 2));
  console.log('[Handoff Direct] Request headers:', req.headers);
  
  // Always set a user for this route - GUARANTEED INITIALIZATION
  req.user = {
    id: 'direct-user-id',
    _id: 'direct-user-id',
    email: 'direct@example.com',
    role: 'user'
  };
  
  console.log('[Handoff Direct] Mock user set:', JSON.stringify(req.user, null, 2));
  
  try {
    // Check if this is a handoff by callId or by phone
    if (req.body.callId) {
      // Set callId as URL parameter for initiateHandoff
      req.params = req.params || {};
      req.params.callId = req.body.callId;
      console.log('[Handoff Direct] Using initiateHandoff with callId:', req.body.callId);
      console.log('[Handoff Direct] req.params set to:', req.params);
      initiateHandoff(req, res, next);
    } else {
      console.log('[Handoff Direct] Using initiateHandoffByPhone');
      initiateHandoffByPhone(req, res, next);
    }
  } catch (error) {
    console.error('[Handoff Direct] Error in route handler:', error);
    res.status(500).json({
      success: false,
      error: 'Route handler error: ' + error.message
    });
  }
  
  console.log('[Handoff Direct] =======================================');
});

module.exports = router;