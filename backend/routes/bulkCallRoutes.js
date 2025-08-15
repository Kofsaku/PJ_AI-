const express = require('express');
const router = express.Router();
const bulkCallController = require('../controllers/bulkCallController');
const { protect } = require('../middlewares/authMiddleware');

// Note: Authentication is optional for development
// Add protect middleware when ready for production: router.post('/bulk', protect, bulkCallController.initiateBulkCalls);

// Initiate bulk calls (no auth for development)
router.post('/bulk', bulkCallController.initiateBulkCalls);

// Get bulk call status
router.get('/bulk/status', bulkCallController.getBulkCallStatus);

// Cancel bulk calls
router.post('/bulk/cancel', bulkCallController.cancelBulkCalls);

module.exports = router;