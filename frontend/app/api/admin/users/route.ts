import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  console.log('=== Admin Users API Route Called ===');
  
  try {
    // Get the backend API URL
    const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001';
    console.log('Backend API URL:', apiUrl);
    
    // Get the authorization header from the incoming request
    const authHeader = request.headers.get('authorization');
    console.log('Authorization header present:', !!authHeader);
    console.log('Authorization header:', authHeader?.substring(0, 50) + '...');
    
    // Log the full backend URL
    const backendUrl = `${apiUrl}/api/users`;
    console.log('Calling backend URL:', backendUrl);
    
    // Make the backend request
    const backendResponse = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader && { 'Authorization': authHeader })
      },
    });

    console.log('Backend response status:', backendResponse.status);
    console.log('Backend response ok:', backendResponse.ok);

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      console.error('Backend error response:', errorText);
      
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText };
      }
      
      return NextResponse.json(
        { 
          error: errorData.error || `Backend returned ${backendResponse.status}`,
          details: errorData,
          users: [] 
        },
        { status: backendResponse.status }
      );
    }

    const data = await backendResponse.json();
    console.log('Backend returned users count:', data.users?.length || 0);
    
    // Return the users data
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('=== Error in Admin Users API ===');
    console.error('Error type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to fetch users',
        details: String(error),
        users: [] 
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001';
    const authHeader = request.headers.get('authorization');
    
    // Extract user ID from the request body or URL
    const { userId, ...updateData } = body;
    
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }
    
    const backendResponse = await fetch(`${apiUrl}/api/users/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader && { 'Authorization': authHeader })
      },
      body: JSON.stringify(updateData),
    });

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error || 'Failed to update user' },
        { status: backendResponse.status }
      );
    }

    const data = await backendResponse.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    );
  }
}