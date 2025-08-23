import { NextRequest, NextResponse } from 'next/server';

const twilio = require('twilio');
const config = require('../../../../../../backend/config/environment');

export async function POST(request: NextRequest) {
  try {
    if (!config.twilio.accountSid || !config.twilio.authToken) {
      return NextResponse.json(
        { success: false, error: 'Twilio credentials not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { areaCode = '607' } = body;
    
    const twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);
    
    // Search for available numbers
    const availableNumbers = await twilioClient.availablePhoneNumbers('US')
      .local
      .list({
        areaCode,
        voiceEnabled: true,
        smsEnabled: false,
        limit: 1,
      });
    
    if (availableNumbers.length === 0) {
      return NextResponse.json(
        { success: false, error: `No available numbers found for area code ${areaCode}` },
        { status: 404 }
      );
    }
    
    // Purchase the first available number
    const numberToPurchase = availableNumbers[0];
    const purchasedNumber = await twilioClient.incomingPhoneNumbers.create({
      phoneNumber: numberToPurchase.phoneNumber,
      voiceUrl: `${config.twilio.webhookBaseUrl}/api/twilio/voice`,
      voiceMethod: 'POST',
      statusCallback: `${config.twilio.webhookBaseUrl}/api/twilio/call/status`,
      statusCallbackMethod: 'POST',
    });
    
    return NextResponse.json({
      success: true,
      message: 'Phone number purchased successfully',
      number: {
        phoneNumber: purchasedNumber.phoneNumber,
        sid: purchasedNumber.sid,
        friendlyName: purchasedNumber.friendlyName,
        monthlyFee: 1.15, // Twilio's standard US number fee
      },
    });
  } catch (error) {
    console.error('Error purchasing phone number:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to purchase phone number' 
      },
      { status: 500 }
    );
  }
}