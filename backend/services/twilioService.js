// Twilio service placeholder
// This file provides basic structure for Twilio integration
// Actual implementation will need valid Twilio credentials

const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

// Check if Twilio credentials are configured
const isTwilioConfigured = twilioAccountSid && twilioAuthToken && twilioPhoneNumber;

let twilioClient = null;
if (isTwilioConfigured) {
  try {
    const twilio = require('twilio');
    twilioClient = twilio(twilioAccountSid, twilioAuthToken);
  } catch (error) {
    console.log('Twilio client not initialized:', error.message);
  }
}

exports.makeCall = async (phoneNumber, sessionId) => {
  if (!isTwilioConfigured) {
    console.log('Twilio not configured - simulating call to:', phoneNumber);
    return {
      sid: 'SIMULATED_CALL_' + sessionId,
      status: 'simulated',
      to: phoneNumber,
      from: 'SIMULATED'
    };
  }

  try {
    // Ensure we have a valid base URL
    const baseUrl = process.env.FRONTEND_URL || process.env.NGROK_URL || 'https://pj-ai-2t27-olw2j2em4-kofsakus-projects.vercel.app';
    console.log('Using base URL for Twilio webhook:', baseUrl);
    
    const call = await twilioClient.calls.create({
      to: phoneNumber,
      from: twilioPhoneNumber,
      url: `${baseUrl}/api/twilio/voice`,
      statusCallback: `${baseUrl}/api/twilio/call/status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST',
      record: true
    });
    
    return call;
  } catch (error) {
    console.error('Twilio call error:', error);
    throw error;
  }
};

exports.endCall = async (callSid) => {
  if (!isTwilioConfigured) {
    console.log('Twilio not configured - simulating end call:', callSid);
    return { status: 'completed' };
  }

  try {
    const call = await twilioClient.calls(callSid).update({
      status: 'completed'
    });
    return call;
  } catch (error) {
    console.error('Twilio end call error:', error);
    throw error;
  }
};

exports.getCallStatus = async (callSid) => {
  if (!isTwilioConfigured) {
    console.log('Twilio not configured - simulating get call status:', callSid);
    return { status: 'completed', duration: 60 };
  }

  try {
    const call = await twilioClient.calls(callSid).fetch();
    return call;
  } catch (error) {
    console.error('Twilio get call status error:', error);
    throw error;
  }
};