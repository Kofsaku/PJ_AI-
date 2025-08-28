const express = require('express');
const router = express.Router();
const { register, login, getMe, updateProfile } = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');

router.post('/signup', register);
router.post('/login', login);
router.get('/me', protect, getMe);

// Users routes
router.put('/users/profile', protect, updateProfile);

module.exports = router;