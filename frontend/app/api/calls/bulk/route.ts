import { NextResponse, NextRequest } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001'

export async function POST(request: NextRequest) {
  try {
    const { phoneNumbers, customerIds } = await request.json()
    
    if (!phoneNumbers || phoneNumbers.length === 0) {
      return NextResponse.json(
        { error: 'No phone numbers provided' },
        { status: 400 }
      )
    }

    // Forward request to backend
    const response = await fetch(`${BACKEND_URL}/api/calls/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phoneNumbers, customerIds })
    })

    if (!response.ok) {
      throw new Error(`Backend responded with status: ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Bulk call error:', error)
    return NextResponse.json(
      { error: 'Failed to initiate bulk calls' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionIds = searchParams.get('sessionIds')
    
    const url = sessionIds 
      ? `${BACKEND_URL}/api/calls/bulk/status?sessionIds=${sessionIds}`
      : `${BACKEND_URL}/api/calls/bulk/status`
    
    const response = await fetch(url, {
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
    console.error('Get bulk call status error:', error)
    return NextResponse.json(
      { error: 'Failed to get call status' },
      { status: 500 }
    )
  }
}