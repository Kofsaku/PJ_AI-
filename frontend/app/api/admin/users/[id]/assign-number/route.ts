import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();
    
    const body = await request.json();
    const { phoneNumber, sid } = body;
    
    if (!phoneNumber || !sid) {
      return NextResponse.json(
        { success: false, error: 'Phone number and SID are required' },
        { status: 400 }
      );
    }
    
    // Check if the number is already assigned to another user
    const existingAssignment = await User.findOne({
      twilioPhoneNumber: phoneNumber,
      _id: { $ne: params.id }
    });
    
    if (existingAssignment) {
      return NextResponse.json(
        { success: false, error: 'This number is already assigned to another user' },
        { status: 409 }
      );
    }
    
    // Update the user with the assigned phone number
    const user = await User.findByIdAndUpdate(
      params.id,
      {
        twilioPhoneNumber: phoneNumber,
        twilioPhoneNumberSid: sid,
        twilioPhoneNumberStatus: 'active',
      },
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Phone number assigned successfully',
      user,
    });
  } catch (error) {
    console.error('Error assigning phone number:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to assign phone number' },
      { status: 500 }
    );
  }
}