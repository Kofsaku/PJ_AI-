import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';

const twilio = require('twilio');
const config = require('../../../../../backend/config/environment');

export async function GET(request: NextRequest) {
  try {
    if (!config.twilio.accountSid || !config.twilio.authToken) {
      return NextResponse.json(
        { success: false, error: 'Twilio credentials not configured' },
        { status: 500 }
      );
    }

    const twilioClient = twilio(config.twilio.accountSid, config.twilio.authToken);
    
    // Get all phone numbers from Twilio
    const twilioNumbers = await twilioClient.incomingPhoneNumbers.list();
    
    // Connect to DB to check assignments
    await connectDB();
    
    // Get all users with assigned phone numbers
    const usersWithNumbers = await User.find({
      twilioPhoneNumber: { $exists: true }
    }, 'twilioPhoneNumber twilioPhoneNumberSid firstName lastName');
    
    // Create a map of assigned numbers
    const assignedNumbers = new Set(usersWithNumbers.map(user => user.twilioPhoneNumber));
    
    // Format the response
    const numbers = twilioNumbers.map((number: any) => ({
      phoneNumber: number.phoneNumber,
      sid: number.sid,
      friendlyName: number.friendlyName || number.phoneNumber,
      isAssigned: assignedNumbers.has(number.phoneNumber),
      assignedTo: usersWithNumbers.find(user => user.twilioPhoneNumber === number.phoneNumber),
      capabilities: {
        voice: number.capabilities.voice,
        sms: number.capabilities.sms,
        mms: number.capabilities.mms,
        fax: number.capabilities.fax,
      },
    }));

    return NextResponse.json({
      success: true,
      numbers,
      total: numbers.length,
      assigned: numbers.filter(n => n.isAssigned).length,
      available: numbers.filter(n => !n.isAssigned).length,
    });
  } catch (error) {
    console.error('Error fetching Twilio numbers:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch phone numbers' },
      { status: 500 }
    );
  }
}