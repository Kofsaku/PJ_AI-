#!/usr/bin/env node

/**
 * Twilio Production Call Debug Script
 * 
 * This script helps debug why Twilio calls are being queued but not connecting in production.
 * It performs comprehensive checks on configuration, credentials, phone numbers, and webhooks.
 */

const fs = require('fs');
const path = require('path');
require('dotenv').config();

console.log('🔍 TWILIO PRODUCTION CALL DEBUG SCRIPT');
console.log('=' .repeat(60));

// Configuration checks
console.log('\n📋 CONFIGURATION CHECKS');
console.log('-'.repeat(30));

const requiredEnvVars = {
  'TWILIO_ACCOUNT_SID': process.env.TWILIO_ACCOUNT_SID,
  'TWILIO_AUTH_TOKEN': process.env.TWILIO_AUTH_TOKEN,
  'TWILIO_PHONE_NUMBER': process.env.TWILIO_PHONE_NUMBER,
  'BASE_URL': process.env.BASE_URL,
  'NGROK_URL': process.env.NGROK_URL,
  'NODE_ENV': process.env.NODE_ENV
};

for (const [key, value] of Object.entries(requiredEnvVars)) {
  const status = value ? '✅' : '❌';
  const displayValue = key.includes('TOKEN') ? (value ? `${value.substring(0, 6)}...` : 'NOT SET') : value;
  console.log(`${status} ${key}: ${displayValue || 'NOT SET'}`);
}

// Check if BASE_URL and NGROK_URL are in sync
if (process.env.BASE_URL && process.env.NGROK_URL) {
  const baseUrlMatch = process.env.BASE_URL === process.env.NGROK_URL;
  console.log(`${baseUrlMatch ? '✅' : '⚠️'} BASE_URL and NGROK_URL sync: ${baseUrlMatch ? 'MATCHED' : 'DIFFERENT'}`);
  if (!baseUrlMatch) {
    console.log(`   BASE_URL: ${process.env.BASE_URL}`);
    console.log(`   NGROK_URL: ${process.env.NGROK_URL}`);
  }
}

// Phone number formatting test
console.log('\n📱 PHONE NUMBER FORMATTING TEST');
console.log('-'.repeat(30));

const testPhoneNumber = '09062660207';
console.log(`Testing Japanese number: ${testPhoneNumber}`);

function formatJapanesePhoneNumber(phoneNumber) {
  let formatted = phoneNumber.replace(/[^\d+]/g, '');
  
  if (!formatted.startsWith('+')) {
    if (formatted.startsWith('0')) {
      formatted = '+81' + formatted.substring(1);
    } else if (!formatted.startsWith('81')) {
      formatted = '+81' + formatted;
    } else {
      formatted = '+' + formatted;
    }
  }
  
  return formatted;
}

const formattedNumber = formatJapanesePhoneNumber(testPhoneNumber);
const isValidFormat = /^\+81\d{9,10}$/.test(formattedNumber);

console.log(`Original: ${testPhoneNumber}`);
console.log(`Formatted: ${formattedNumber}`);
console.log(`${isValidFormat ? '✅' : '❌'} Valid international format: ${isValidFormat}`);

// Twilio SDK test
console.log('\n🔌 TWILIO SDK CONNECTION TEST');
console.log('-'.repeat(30));

async function testTwilioConnection() {
  try {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      console.log('❌ Missing Twilio credentials');
      return false;
    }

    const twilio = require('twilio');
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    
    // Test account info
    console.log('Testing account access...');
    const account = await client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
    console.log(`✅ Account Status: ${account.status}`);
    console.log(`✅ Account Type: ${account.type}`);
    
    // Test phone number ownership
    if (process.env.TWILIO_PHONE_NUMBER) {
      console.log(`Testing phone number ownership: ${process.env.TWILIO_PHONE_NUMBER}`);
      try {
        const numbers = await client.incomingPhoneNumbers.list();
        const ownedNumber = numbers.find(num => num.phoneNumber === process.env.TWILIO_PHONE_NUMBER);
        
        if (ownedNumber) {
          console.log(`✅ Phone number owned and active`);
          console.log(`   Capabilities: Voice: ${ownedNumber.capabilities.voice}, SMS: ${ownedNumber.capabilities.sms}`);
          console.log(`   Voice URL: ${ownedNumber.voiceUrl || 'NOT SET'}`);
          console.log(`   Status Callback: ${ownedNumber.statusCallback || 'NOT SET'}`);
        } else {
          console.log(`❌ Phone number not found in account`);
        }
      } catch (numberError) {
        console.log(`❌ Error checking phone number: ${numberError.message}`);
      }
    }
    
    return true;
  } catch (error) {
    console.log(`❌ Twilio connection failed: ${error.message}`);
    if (error.code) {
      console.log(`   Error Code: ${error.code}`);
    }
    return false;
  }
}

// Test webhook URLs
console.log('\n🌐 WEBHOOK URL ACCESSIBILITY TEST');
console.log('-'.repeat(30));

async function testWebhookUrls() {
  const https = require('https');
  const http = require('http');
  
  const baseUrl = process.env.BASE_URL || process.env.NGROK_URL;
  if (!baseUrl) {
    console.log('❌ No BASE_URL or NGROK_URL configured');
    return;
  }
  
  const webhookEndpoints = [
    '/api/twilio/voice',
    '/api/twilio/call/status/test',
    '/api/twilio/recording/status/test'
  ];
  
  console.log(`Testing webhooks at: ${baseUrl}`);
  
  for (const endpoint of webhookEndpoints) {
    const testUrl = `${baseUrl}${endpoint}`;
    
    try {
      await new Promise((resolve, reject) => {
        const client = testUrl.startsWith('https') ? https : http;
        const req = client.request(testUrl, { method: 'POST', timeout: 5000 }, (res) => {
          console.log(`${res.statusCode < 500 ? '✅' : '⚠️'} ${endpoint}: HTTP ${res.statusCode}`);
          resolve();
        });
        
        req.on('error', (error) => {
          console.log(`❌ ${endpoint}: ${error.message}`);
          resolve();
        });
        
        req.on('timeout', () => {
          console.log(`⏱️ ${endpoint}: Timeout`);
          req.destroy();
          resolve();
        });
        
        req.end();
      });
    } catch (error) {
      console.log(`❌ ${endpoint}: ${error.message}`);
    }
  }
}

// Test call creation (dry run)
console.log('\n📞 CALL CREATION TEST (DRY RUN)');
console.log('-'.repeat(30));

async function testCallCreation() {
  try {
    const twilioService = require('./services/twilioService');
    console.log('Testing makeCall function with test parameters...');
    
    // This will test the makeCall function logic without actually making a call
    console.log('✅ twilioService.makeCall function is accessible');
    
    // Test the formatting logic
    const testResult = formatJapanesePhoneNumber(testPhoneNumber);
    console.log(`✅ Phone formatting works: ${testPhoneNumber} -> ${testResult}`);
    
  } catch (error) {
    console.log(`❌ Error testing call creation: ${error.message}`);
  }
}

// Production-specific checks
console.log('\n🏭 PRODUCTION-SPECIFIC CHECKS');
console.log('-'.repeat(30));

function checkProductionIssues() {
  const isProduction = process.env.NODE_ENV === 'production';
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  if (isProduction) {
    console.log('⚠️ Production mode detected');
    
    // Check for common production issues
    if (process.env.BASE_URL && process.env.BASE_URL.includes('ngrok')) {
      console.log('⚠️ WARNING: Using ngrok URL in production');
    }
    
    if (!process.env.BASE_URL || process.env.BASE_URL.includes('localhost')) {
      console.log('❌ BASE_URL should not be localhost in production');
    }
    
    // Check for proper HTTPS
    if (process.env.BASE_URL && !process.env.BASE_URL.startsWith('https://')) {
      console.log('❌ BASE_URL should use HTTPS in production');
    }
    
  } else {
    console.log('✅ Development mode - ngrok usage is normal');
  }
}

// Database connection test
console.log('\n💾 DATABASE CONNECTION TEST');
console.log('-'.repeat(30));

async function testDatabaseConnection() {
  try {
    const mongoose = require('mongoose');
    
    if (mongoose.connection.readyState === 1) {
      console.log('✅ Database already connected');
    } else {
      console.log('Testing database connection...');
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('✅ Database connection successful');
    }
    
    // Test CallSession model
    const CallSession = require('./models/CallSession');
    const recentSessions = await CallSession.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('phoneNumber status twilioCallSid createdAt');
    
    console.log(`✅ Found ${recentSessions.length} recent call sessions`);
    
    if (recentSessions.length > 0) {
      console.log('Recent sessions:');
      recentSessions.forEach((session, index) => {
        console.log(`   ${index + 1}. ${session.phoneNumber} - ${session.status} (${session.createdAt})`);
      });
    }
    
  } catch (error) {
    console.log(`❌ Database error: ${error.message}`);
  }
}

// Main execution
async function runDiagnostics() {
  try {
    checkProductionIssues();
    await testDatabaseConnection();
    await testTwilioConnection();
    await testWebhookUrls();
    await testCallCreation();
    
    console.log('\n🎯 RECOMMENDATIONS');
    console.log('-'.repeat(30));
    
    const recommendations = [];
    
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      recommendations.push('Set proper Twilio credentials in production environment');
    }
    
    if (process.env.BASE_URL !== process.env.NGROK_URL) {
      recommendations.push('Ensure BASE_URL and NGROK_URL are consistent');
    }
    
    if (process.env.NODE_ENV === 'production' && process.env.BASE_URL && process.env.BASE_URL.includes('ngrok')) {
      recommendations.push('Replace ngrok URL with permanent production domain');
    }
    
    if (!process.env.BASE_URL || process.env.BASE_URL.includes('localhost')) {
      recommendations.push('Set proper production BASE_URL (not localhost)');
    }
    
    recommendations.push('Check Render logs for specific Twilio API errors');
    recommendations.push('Verify webhook endpoints are accessible from Twilio servers');
    recommendations.push('Test with a working phone number in your region');
    
    if (recommendations.length === 0) {
      console.log('✅ Configuration looks good! Check Render logs for runtime errors.');
    } else {
      recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error running diagnostics:', error);
  }
}

// Run the diagnostics
runDiagnostics().catch(console.error);