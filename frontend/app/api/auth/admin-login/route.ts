import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    
    console.log('=== Admin Login API Called ===');
    console.log('Email:', email);
    console.log('Password length:', password?.length || 0);
    console.log('Timestamp:', new Date().toISOString());
    
    // Call backend login API to get proper JWT token
    // Use 127.0.0.1 instead of localhost for better compatibility
    const apiUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'https://pj-ai.onrender.com';
    const backendUrl = `${apiUrl}/api/auth/login`;
    console.log('Calling backend URL:', backendUrl);
    
    const backendResponse = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await backendResponse.json();
    console.log('Backend response status:', backendResponse.status);
    console.log('Backend response success:', data.success);
    
    if (data.user) {
      console.log('User found - Role:', data.user.role, 'Email:', data.user.email);
    }
    
    if (data.error) {
      console.log('Backend error:', data.error);
    }

    if (!backendResponse.ok) {
      console.error('Backend login failed:', data.error);
      return NextResponse.json(
        { error: data.error || 'Invalid credentials' },
        { status: backendResponse.status }
      );
    }

    // Verify the user is an admin
    if (data.user && data.user.role !== 'admin') {
      console.error('User is not admin. Role:', data.user.role);
      return NextResponse.json(
        { error: 'Access denied. Admin privileges required.' },
        { status: 403 }
      );
    }

    console.log('✅ Admin login successful!');
    console.log('Token generated:', !!data.token);
    console.log('User ID:', data.user?.id);

    // Return the backend response with proper JWT token
    return NextResponse.json({
      ...data.user,
      token: data.token,
      success: true
    }, { status: 200 });
    
  } catch (error) {
    console.error('=== Admin Login API Error ===');
    console.error('Error type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    
    return NextResponse.json(
      { error: 'Internal server error: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    );
  }
}