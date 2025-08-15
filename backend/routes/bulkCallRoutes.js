const express = require('express');
const router = express.Router();
const bulkCallController = require('../controllers/bulkCallController');

// Initiate bulk calls
router.post('/bulk', bulkCallController.initiateBulkCalls);

// Get bulk call status
router.get('/bulk/status', bulkCallController.getBulkCallStatus);

// Cancel bulk calls
router.post('/bulk/cancel', bulkCallController.cancelBulkCalls);

module.exports = router;