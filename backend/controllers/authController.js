const User = require('../models/User');
const Company = require('../models/Company');
const EmailVerification = require('../models/EmailVerification');
const emailService = require('../services/emailService');
const jwt = require('jsonwebtoken');
const asyncHandler = require('../middlewares/asyncHandler');
const crypto = require('crypto');

// @desc    Register user
// @route   POST /api/auth/signup
// @access  Public
exports.register = asyncHandler(async (req, res, next) => {
  console.log('=== SIGNUP REQUEST DEBUG ===');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  
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

  console.log('=== EXTRACTED FIELDS ===');
  console.log('companyId:', companyId);
  console.log('companyName:', companyName);
  console.log('email:', email);
  console.log('password:', password ? '[PROVIDED]' : '[MISSING]');
  console.log('firstName:', firstName);
  console.log('lastName:', lastName);
  console.log('phone:', phone);
  console.log('address:', address);
  console.log('businessType:', businessType);
  console.log('employees:', employees);
  console.log('description:', description);

  // Validate company ID
  const company = await Company.findOne({ companyId: companyId, status: 'active' });
  if (!company) {
    console.log('Company validation failed for companyId:', companyId);
    return res.status(400).json({
      success: false,
      error: 'Invalid company ID',
    });
  }

  console.log('Company found:', company.name);

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    console.log('User already exists with email:', email);
    return res.status(400).json({
      success: false,
      error: 'Email already in use',
    });
  }

  // Check if this is the first user for this company
  const existingUsers = await User.countDocuments({ companyId });
  console.log('Existing users for company:', existingUsers);
  
  // Prepare user data for creation
  const userData = {
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
    isCompanyAdmin: existingUsers === 0, // 最初のユーザーを企業管理者にする
  };

  console.log('=== USER DATA FOR CREATION ===');
  console.log(JSON.stringify(userData, null, 2));

  try {
    // Create user
    const user = await User.create(userData);
    
    console.log('User created successfully:', user.email);

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
  } catch (error) {
    console.log('=== USER CREATION ERROR ===');
    console.log('Error name:', error.name);
    console.log('Error message:', error.message);
    console.log('Validation errors:', error.errors);
    console.log('Full error:', error);
    
    // Send detailed error information
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      details: error.message,
      validationErrors: error.errors
    });
  }
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

// @desc    Send verification code to email
// @route   POST /api/auth/send-verification-code
// @access  Public
exports.sendVerificationCode = asyncHandler(async (req, res, next) => {
  console.log('=== SEND VERIFICATION CODE DEBUG ===');
  console.log('Request method:', req.method);
  console.log('Content-Type:', req.headers['content-type']);
  console.log('Request headers:', JSON.stringify(req.headers, null, 2));
  console.log('Request body type:', typeof req.body);
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  console.log('Request body keys:', Object.keys(req.body || {}));

  const { 
    email, 
    companyId, 
    companyName,
    businessName,
    businessPhone,
    address,
    businessType,
    employees,
    description,
    // Legacy support for old format
    companyData 
  } = req.body;

  // Validate required fields
  if (!email || !companyId) {
    return res.status(400).json({
      success: false,
      error: 'メールアドレスと企業IDが必要です',
    });
  }

  // Prepare company data object (support both old and new formats)
  const processedCompanyData = companyData || {
    companyName,
    businessName,
    businessPhone,
    address,
    businessType,
    employees,
    description
  };

  try {
    console.log('Checking company with ID:', companyId);
    // Check if company exists and is active
    const company = await Company.findOne({ companyId, status: 'active' });
    console.log('Found company:', company ? 'YES' : 'NO');
    if (!company) {
      console.log('Company not found or not active');
      return res.status(400).json({
        success: false,
        error: '無効な企業IDです',
      });
    }

    // Check if user with this email already exists
    console.log('Checking existing user with email:', email);
    const existingUser = await User.findOne({ email });
    console.log('Found existing user:', existingUser ? 'YES' : 'NO');
    if (existingUser) {
      console.log('User already exists');
      return res.status(400).json({
        success: false,
        error: 'このメールアドレスは既に使用されています',
      });
    }

    // Rate limiting: Check if verification code was sent recently
    const recentVerification = await EmailVerification.findOne({
      email,
      createdAt: { $gt: new Date(Date.now() - 60000) }, // 1分以内
    });

    if (recentVerification) {
      return res.status(429).json({
        success: false,
        error: '認証コードの送信は1分間に1回までです',
      });
    }

    // Generate 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    console.log('Generated verification code:', verificationCode);

    // Delete any existing verification records for this email
    await EmailVerification.deleteMany({ email });

    // Create verification record
    const verification = await EmailVerification.create({
      email,
      verificationCode,
      companyId,
      companyData: processedCompanyData,
    });

    console.log('Verification record created:', verification._id);

    // 開発環境では実際のメール送信をスキップして、ログで認証コードを確認
    if (process.env.NODE_ENV === 'development') {
      console.log('=== DEVELOPMENT MODE: EMAIL VERIFICATION CODE ===');
      console.log(`Email: ${email}`);
      console.log(`Verification Code: ${verificationCode}`);
      console.log(`Company: ${company.name}`);
      console.log('=== EMAIL SENDING SKIPPED IN DEVELOPMENT ===');
    } else {
      // Send verification email
      const emailResult = await emailService.sendVerificationCode(
        email,
        verificationCode,
        company.name
      );

      if (!emailResult.success) {
        console.error('Email sending failed:', emailResult.error);
        return res.status(500).json({
          success: false,
          error: 'メールの送信に失敗しました',
        });
      }

      console.log('Verification email sent successfully');
    }

    res.status(200).json({
      success: true,
      message: '認証コードをメールアドレスに送信しました',
      token: verification._id, // 一時的なトークンとしてverification IDを使用
      data: {
        email,
        expiresAt: verification.expiresAt,
      },
    });

  } catch (error) {
    console.error('=== SEND VERIFICATION CODE ERROR ===');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Full error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: 'サーバーエラーが発生しました',
    });
  }
});

// @desc    Verify email verification code
// @route   POST /api/auth/verify-email-code
// @access  Public
exports.verifyEmailCode = asyncHandler(async (req, res, next) => {
  console.log('=== VERIFY EMAIL CODE DEBUG ===');
  console.log('Request body:', JSON.stringify(req.body, null, 2));

  const { email, verificationCode } = req.body;
  
  console.log('Extracted email:', email);
  console.log('Extracted verificationCode:', verificationCode);
  console.log('Email type:', typeof email);
  console.log('VerificationCode type:', typeof verificationCode);

  // Validate required fields
  if (!email || !verificationCode) {
    console.log('Validation failed - Missing required fields');
    console.log('Email check:', !email, 'Code check:', !verificationCode);
    return res.status(400).json({
      success: false,
      error: 'メールアドレスと認証コードが必要です',
    });
  }

  try {
    // Find verification record
    const verification = await EmailVerification.findOne({
      email,
      isVerified: false,
    }).sort({ createdAt: -1 }); // 最新のレコードを取得

    if (!verification) {
      return res.status(400).json({
        success: false,
        error: '認証コードが見つからないか、既に使用されています',
      });
    }

    // Check if expired
    if (verification.isExpired()) {
      return res.status(400).json({
        success: false,
        error: '認証コードの有効期限が切れています',
      });
    }

    // Check attempt limit
    if (verification.attempts >= 5) {
      return res.status(429).json({
        success: false,
        error: '認証試行回数の上限に達しました。新しい認証コードを発行してください',
      });
    }

    // Increment attempt count
    verification.attempts += 1;
    await verification.save();

    // Verify the code
    const isValidCode = await verification.compareVerificationCode(verificationCode);
    
    if (!isValidCode) {
      console.log('Invalid verification code provided');
      return res.status(400).json({
        success: false,
        error: '認証コードが正しくありません',
        attemptsRemaining: 5 - verification.attempts,
      });
    }

    // Mark as verified
    verification.isVerified = true;
    await verification.save();

    // Create temporary JWT token for account creation
    const tempToken = jwt.sign(
      {
        email: verification.email,
        companyId: verification.companyId,
        companyData: verification.companyData,
        type: 'email_verified',
      },
      process.env.JWT_SECRET,
      { expiresIn: '30m' } // 30分間有効
    );

    console.log('Email verification successful for:', email);

    res.status(200).json({
      success: true,
      message: 'メールアドレスの認証が完了しました',
      data: {
        tempToken,
        email,
      },
    });

  } catch (error) {
    console.error('Verify email code error:', error);
    res.status(500).json({
      success: false,
      error: 'サーバーエラーが発生しました',
    });
  }
});

// @desc    Complete registration after email verification
// @route   POST /api/auth/complete-registration
// @access  Public
exports.completeRegistration = asyncHandler(async (req, res, next) => {
  console.log('=== COMPLETE REGISTRATION DEBUG ===');
  console.log('Request body:', JSON.stringify(req.body, null, 2));

  const { tempToken, firstName, lastName, password } = req.body;

  // Validate required fields
  if (!tempToken || !firstName || !lastName || !password) {
    return res.status(400).json({
      success: false,
      error: '必要な情報が不足しています',
    });
  }

  try {
    // Verify temporary token
    const decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
    
    if (decoded.type !== 'email_verified') {
      return res.status(400).json({
        success: false,
        error: '無効な認証トークンです',
      });
    }

    console.log('Decoded token:', decoded);

    // Check if user already exists
    const existingUser = await User.findOne({ email: decoded.email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'このメールアドレスは既に使用されています',
      });
    }

    // Check if company still exists
    const company = await Company.findOne({ companyId: decoded.companyId, status: 'active' });
    if (!company) {
      return res.status(400).json({
        success: false,
        error: '企業情報が見つからないか、無効になっています',
      });
    }

    // Check if this is the first user for this company
    const existingUsers = await User.countDocuments({ companyId: decoded.companyId });
    
    // Create user data
    const userData = {
      companyId: decoded.companyId,
      companyName: company.name,
      email: decoded.email,
      password,
      firstName,
      lastName,
      phone: decoded.companyData.businessPhone,
      address: decoded.companyData.address,
      businessType: decoded.companyData.businessType,
      employees: decoded.companyData.employees,
      description: decoded.companyData.description || '',
      isCompanyAdmin: existingUsers === 0, // 最初のユーザーを企業管理者にする
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
    };

    console.log('Creating user with data:', JSON.stringify(userData, null, 2));

    // Create user
    const user = await User.create(userData);
    
    console.log('User created successfully:', user.email);

    // Create final JWT token
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
        isCompanyAdmin: user.isCompanyAdmin,
      },
    });

  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      console.log('Invalid or expired token:', error.message);
      return res.status(400).json({
        success: false,
        error: '認証トークンが無効または期限切れです。最初からやり直してください',
      });
    }

    console.error('Complete registration error:', error);
    res.status(500).json({
      success: false,
      error: 'サーバーエラーが発生しました',
    });
  }
});

