const User = require('../models/User');
const Company = require('../models/Company');
const jwt = require('jsonwebtoken');
const asyncHandler = require('../middlewares/asyncHandler');

// @desc    Register user
// @route   POST /api/auth/signup
// @access  Public
exports.register = asyncHandler(async (req, res, next) => {
  const {
    companyId,
    companyName,
    email,
    password,
    firstName,
    lastName,
    phone,
    address,
    businessType,
    employees,
    description,
  } = req.body;

  // Validate company ID
  const company = await Company.findOne({ companyId: companyId, status: 'active' });
  if (!company) {
    return res.status(400).json({
      success: false,
      error: 'Invalid company ID',
    });
  }

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(400).json({
      success: false,
      error: 'Email already in use',
    });
  }

  // Create user
  const user = await User.create({
    companyId,
    companyName: company.name,
    email,
    password,
    firstName,
    lastName,
    phone,
    address,
    businessType,
    employees,
    description,
  });

  // Create token
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });

  res.status(201).json({
    success: true,
    token,
    data: {
      id: user._id,
      companyId: user.companyId,
      companyName: user.companyName,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    },
  });
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  // Validate email and password
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Please provide an email and password',
    });
  }

  // Check for user
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Invalid credentials',
    });
  }

  // Check if password matches
  const isMatch = await user.comparePassword(password);

  if (!isMatch) {
    return res.status(401).json({
      success: false,
      error: 'Invalid credentials',
    });
  }

  // Create token
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });

  res.status(200).json({
    success: true,
    token,
    data: {
      id: user._id,
      companyId: user.companyId,
      companyName: user.companyName,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    },
  });
});


// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id).select('-password');

  res.status(200).json({
    success: true,
    data: user,
  });
});

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
exports.updateProfile = asyncHandler(async (req, res, next) => {
  const { username, name, email, phone, handoffPhoneNumber } = req.body;
  const userId = req.user.id;

  const updateData = {};
  
  if (username !== undefined) updateData.username = username;
  if (name !== undefined) {
    updateData.firstName = name.split(' ')[0] || name;
    updateData.lastName = name.split(' ').slice(1).join(' ') || '';
  }
  if (email !== undefined) updateData.email = email;
  if (phone !== undefined) updateData.phone = phone;
  if (handoffPhoneNumber !== undefined) {
    // 電話番号のバリデーション
    const cleanedNumber = handoffPhoneNumber.replace(/[-\s]/g, '');
    if (cleanedNumber && !/^0\d{9,10}$/.test(cleanedNumber)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Japanese phone number format',
      });
    }
    updateData.handoffPhoneNumber = cleanedNumber;
  }

  const user = await User.findByIdAndUpdate(
    userId,
    updateData,
    { new: true, runValidators: true }
  ).select('-password');

  res.status(200).json({
    success: true,
    data: user,
  });
});