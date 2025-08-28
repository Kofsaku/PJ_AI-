import { NextResponse, NextRequest } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001'

export async function GET(
  request: NextRequest,
  { params }: { params: { callId: string } }
) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/calls/${params.callId}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Backend responded with status: ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Get call details error:', error)
    return NextResponse.json(
      { error: 'Failed to get call details' },
      { status: 500 }
    )
  }
}