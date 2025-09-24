import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NODE_ENV === 'development'
  ? (process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001')
  : (process.env.NEXT_PUBLIC_BACKEND_URL_PROD || 'https://pj-ai.onrender.com');

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authHeader = request.headers.get('authorization');
    const { id } = params;

    console.log('[Unassign Phone API] User ID:', id);
    console.log('[Unassign Phone API] Authorization header:', authHeader ? '***' : 'none');

    if (!authHeader) {
      return NextResponse.json(
        {
          success: false,
          message: 'No authorization token provided',
        },
        { status: 401 },
      );
    }

    const response = await fetch(`${BACKEND_URL}/api/users/${id}/unassign-phone`, {
      method: 'DELETE',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });

    console.log('[Unassign Phone API] Backend response status:', response.status);

    const data = await response
      .json()
      .catch(async () => {
        const text = await response.text();
        console.log('[Unassign Phone API] Non-JSON response:', text);
        return {
          success: false,
          message: text || 'Unexpected backend response',
        };
      });

    if (!response.ok) {
      console.log('[Unassign Phone API] Error response:', data);
      return NextResponse.json(
        {
          success: false,
          message: data.message || `Backend error: ${response.status}`,
        },
        { status: response.status },
      );
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error('[Unassign Phone API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Internal server error',
      },
      { status: 500 },
    );
  }
}
