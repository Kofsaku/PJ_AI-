// Direct handoff routes without authentication for development
const express = require('express');
const router = express.Router();
const { initiateHandoffByPhone } = require('../controllers/handoffController');

// Direct route without any middleware
router.post('/handoff-direct', (req, res, next) => {
  // Always set a user for this route
  req.user = {
    id: 'direct-user-id',
    _id: 'direct-user-id',
    email: 'direct@example.com'
  };
  console.log('[Handoff Direct] Processing request with mock user');
  initiateHandoffByPhone(req, res, next);
});

module.exports = router;