const mongoose = require('mongoose');
const User = require('./models/User');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function fixAdminPassword() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Find admin account
    let admin = await User.findOne({ email: 'admin@example.com' });
    
    if (!admin) {
      console.log('Creating new admin account...');
      
      // Directly create with hashed password (bypass pre-save hook)
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('admin123', salt);
      
      admin = new User({
        email: 'admin@example.com',
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        companyId: 'ADMIN',
        companyName: 'Admin Company',
        role: 'admin',
        phone: '090-0000-0000',
        address: 'Tokyo, Japan',
        businessType: 'it',
        employees: '1-10',
        description: 'System Administrator'
      });
      
      // Skip the pre-save middleware
      await admin.save({ validateBeforeSave: false });
      console.log('✅ New admin created');
      
    } else {
      console.log('Updating existing admin password...');
      
      // Generate new hash
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('admin123', salt);
      
      // Direct database update to bypass pre-save hook
      await User.updateOne(
        { email: 'admin@example.com' },
        { 
          $set: { 
            password: hashedPassword,
            role: 'admin'
          }
        }
      );
      
      console.log('✅ Admin password updated directly in database');
    }

    console.log('\n========================================');
    console.log('Admin Login Credentials:');
    console.log('Email: admin@example.com');
    console.log('Password: admin123');
    console.log('========================================\n');
    
    // Test the password
    console.log('Testing login...');
    const testAdmin = await User.findOne({ email: 'admin@example.com' }).select('+password');
    
    if (testAdmin) {
      console.log('Admin found, testing password...');
      console.log('Password hash exists:', !!testAdmin.password);
      console.log('Hash starts with $2:', testAdmin.password.startsWith('$2'));
      
      // Test with bcrypt directly
      const directTest = await bcrypt.compare('admin123', testAdmin.password);
      console.log('Direct bcrypt test:', directTest ? '✅ PASS' : '❌ FAIL');
      
      // Test with model method
      if (testAdmin.comparePassword) {
        const methodTest = await testAdmin.comparePassword('admin123');
        console.log('Model method test:', methodTest ? '✅ PASS' : '❌ FAIL');
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixAdminPassword();