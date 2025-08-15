import { NextResponse, NextRequest } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const response = await fetch(`${BACKEND_URL}/api/calls/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Backend error:', errorText)
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