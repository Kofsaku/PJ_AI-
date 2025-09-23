const express = require('express');
const router = express.Router();
const { register, login, adminLogin, getMe, updateProfile, sendVerificationCode, verifyEmailCode, completeRegistration, getAllUsers } = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');

router.post('/signup', register);
router.post('/login', login);
router.post('/admin-login', adminLogin);
router.get('/me', protect, getMe);

// Email verification routes
router.post('/send-verification-code', sendVerificationCode);
router.post('/verify-email-code', verifyEmailCode);
router.post('/complete-registration', completeRegistration);

// Users routes
router.put('/users/profile', protect, updateProfile);

// Admin routes
router.get('/admin/users', protect, getAllUsers);

module.exports = router;