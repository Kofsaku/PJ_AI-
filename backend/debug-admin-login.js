const mongoose = require('mongoose');
const User = require('./models/User');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function debugAdminLogin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // admin@gmail.comを検索
    const admin = await User.findOne({ email: 'admin@gmail.com' }).select('+password');
    
    if (!admin) {
      console.log('❌ admin@gmail.com not found');
      
      // 全ての管理者を表示
      const allAdmins = await User.find({ role: 'admin' }).select('email');
      console.log('\nExisting admin accounts:');
      allAdmins.forEach(a => console.log('- ' + a.email));
      
      process.exit(1);
    }
    
    console.log('=== Account Details ===');
    console.log('Email:', admin.email);
    console.log('Role:', admin.role);
    console.log('CompanyId:', admin.companyId);
    console.log('CompanyName:', admin.companyName);
    console.log('Password hash exists:', !!admin.password);
    console.log('Password hash length:', admin.password ? admin.password.length : 0);
    console.log('Password hash prefix:', admin.password ? admin.password.substring(0, 10) : 'N/A');
    
    // パスワードのテスト
    console.log('\n=== Password Tests ===');
    const testPassword = 'admin123';
    
    // bcrypt.compareを直接使用
    const directMatch = await bcrypt.compare(testPassword, admin.password);
    console.log('Direct bcrypt.compare result:', directMatch);
    
    // comparePasswordメソッドのテスト
    if (admin.comparePassword) {
      const methodMatch = await admin.comparePassword(testPassword);
      console.log('comparePassword method result:', methodMatch);
    } else {
      console.log('comparePassword method not found');
    }
    
    // 手動でハッシュを生成してテスト
    const manualHash = await bcrypt.hash(testPassword, 10);
    console.log('\n=== Manual Hash Test ===');
    console.log('Manual hash prefix:', manualHash.substring(0, 10));
    const manualMatch = await bcrypt.compare(testPassword, manualHash);
    console.log('Manual hash matches:', manualMatch);
    
    // authControllerと同じロジックでテスト
    console.log('\n=== Login Simulation ===');
    const email = 'admin@gmail.com';
    const password = 'admin123';
    
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      console.log('User not found');
    } else {
      console.log('User found:', user.email);
      const isMatch = await user.comparePassword(password);
      console.log('Password match result:', isMatch);
      
      if (!isMatch) {
        console.log('Login would fail: Invalid credentials');
      } else {
        console.log('Login would succeed');
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

debugAdminLogin();