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
  
  console.log('Login attempt for email:', email);

  // Validate email and password
  if (!email || !password) {
    console.log('Missing email or password');
    return res.status(400).json({
      success: false,
      error: 'Please provide an email and password',
    });
  }

  // Check for user
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    console.log('User not found for email:', email);
    return res.status(401).json({
      success: false,
      error: 'Invalid credentials',
    });
  }
  
  console.log('User found:', user.email, 'Role:', user.role);

  // Check if password matches
  const isMatch = await user.comparePassword(password);

  if (!isMatch) {
    console.log('Password mismatch for user:', email);
    return res.status(401).json({
      success: false,
      error: 'Invalid credentials',
    });
  }
  
  console.log('Login successful for:', email);

  // Get latest company name
  let companyName = user.companyName;
  if (user.companyId) {
    const company = await Company.findOne({ companyId: user.companyId });
    if (company) {
      companyName = company.name;
      // Update user's companyName if it has changed
      if (user.companyName !== company.name) {
        user.companyName = company.name;
        await user.save();
      }
    }
  }

  // Create token
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });

  res.status(200).json({
    success: true,
    token,
    user: {
      id: user._id,
      companyId: user.companyId,
      companyName: companyName,
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

  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found'
    });
  }

  // Ensure company information is up to date
  if (user.companyId) {
    const company = await Company.findOne({ companyId: user.companyId });
    if (company) {
      user.companyName = company.name;
    }
  }

  res.status(200).json({
    success: true,
    data: user,
  });
});

// @desc    Update user profile
// @route   PUT /api/users/profile
// @access  Private
exports.updateProfile = asyncHandler(async (req, res, next) => {
  const { name, email, phone, handoffPhoneNumber, aiCallName } = req.body;
  const userId = req.user.id;

  console.log('Update profile request:', { userId, name, email, phone, handoffPhoneNumber, aiCallName });

  const updateData = {};
  
  // Handle name updates (split into firstName and lastName) - Japanese order (姓 名)
  if (name !== undefined && name !== null) {
    const nameParts = name.trim().split(' ');
    if (nameParts.length > 0) {
      // In Japanese order: first part is lastName (姓), second part is firstName (名)
      updateData.lastName = nameParts[0];
      updateData.firstName = nameParts.slice(1).join(' ') || '';
    }
  }
  
  if (email !== undefined && email !== null) {
    updateData.email = email;
  }
  
  if (phone !== undefined && phone !== null) {
    updateData.phone = phone;
  }
  
  if (handoffPhoneNumber !== undefined && handoffPhoneNumber !== null) {
    // 電話番号のバリデーション
    const cleanedNumber = handoffPhoneNumber.replace(/[-\s]/g, '');
    if (cleanedNumber && !/^0\d{9,10}$/.test(cleanedNumber)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Japanese phone number format',
      });
    }
    updateData.handoffPhoneNumber = cleanedNumber || '';
  }
  
  if (aiCallName !== undefined && aiCallName !== null) {
    updateData.aiCallName = aiCallName;
  }

  console.log('Update data:', updateData);

  const user = await User.findByIdAndUpdate(
    userId,
    updateData,
    { new: true, runValidators: true }
  ).select('-password');

  if (!user) {
    return res.status(404).json({
      success: false,
      error: 'User not found',
    });
  }

  console.log('User updated successfully:', user.email);

  res.status(200).json({
    success: true,
    data: user,
  });
});