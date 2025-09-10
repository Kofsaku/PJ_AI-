const express = require('express');
const router = express.Router();
const { register, login, getMe, updateProfile, sendVerificationCode, verifyEmailCode, completeRegistration } = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');

router.post('/signup', register);
router.post('/login', login);
router.get('/me', protect, getMe);

// Email verification routes
router.post('/send-verification-code', sendVerificationCode);
router.post('/verify-email-code', verifyEmailCode);
router.post('/complete-registration', completeRegistration);

// Users routes
router.put('/users/profile', protect, updateProfile);

module.exports = router;