import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
    const authHeader = request.headers.get('authorization');
    
    const backendResponse = await fetch(`${apiUrl}/api/users/phone-numbers/available`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader && { 'Authorization': authHeader })
      },
    });

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error || 'Failed to fetch available phone numbers' },
        { status: backendResponse.status }
      );
    }

    const data = await backendResponse.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Error fetching available phone numbers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch available phone numbers' },
      { status: 500 }
    );
  }
}