import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import User from '@/models/User';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();
    
    // Update the user to unassign the phone number
    const user = await User.findByIdAndUpdate(
      params.id,
      {
        $unset: {
          twilioPhoneNumber: 1,
          twilioPhoneNumberSid: 1,
        },
        twilioPhoneNumberStatus: 'pending',
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
      message: 'Phone number unassigned successfully',
      user,
    });
  } catch (error) {
    console.error('Error unassigning phone number:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to unassign phone number' },
      { status: 500 }
    );
  }
}