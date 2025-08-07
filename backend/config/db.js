const mongoose = require('mongoose');
const User = require('../models/User');

const connectDB = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected...');

    // Manage admin user
    await manageAdminUser();
    
    return mongoose.connection;
  } catch (err) {
    console.error('Database connection error:', err.message);
    process.exit(1);
  }
};

async function manageAdminUser() {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'password123';
    
    // Remove any existing admins first
    const deleteResult = await User.deleteMany({ role: 'admin' });
    if (deleteResult.deletedCount > 1) {
      console.log(`Removed ${deleteResult.deletedCount} previous admin(s)`);
    }

    // Create new admin by directly inserting into collection to bypass validation
    await User.create({
      username: 'admin',
      email: adminEmail,
      password: adminPassword,
      role: 'admin',
      companyName: 'Admin Company',
      firstName: 'Admin',
      lastName: 'User',
      phone: '000-000-0000',
      address: 'Admin Address',
      businessType: 'it',
      employees: '1-10',
      description: 'System Administrator'
    });

    console.log('New admin user created successfully:', adminEmail);
  } catch (err) {
    console.error('Error managing admin user:', err.message);
    // Don't exit process here - let the application decide
  }
}

module.exports = connectDB;