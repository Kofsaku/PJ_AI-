import { NextRequest, NextResponse } from 'next/server';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001';
    const authHeader = request.headers.get('authorization');
    
    const backendResponse = await fetch(`${apiUrl}/api/users/${params.id}/unassign-phone`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader && { 'Authorization': authHeader })
      },
    });

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error || 'Failed to unassign phone number' },
        { status: backendResponse.status }
      );
    }

    const data = await backendResponse.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Error unassigning phone number:', error);
    return NextResponse.json(
      { error: 'Failed to unassign phone number' },
      { status: 500 }
    );
  }
}