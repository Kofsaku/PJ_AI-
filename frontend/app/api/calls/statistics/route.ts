import { NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000'

export async function GET() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/calls/statistics`, {
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      // Return default statistics if backend is not ready
      return NextResponse.json({ 
        data: {
          totalCalls: 0,
          successRate: '0',
          avgDuration: 0,
          activeCallsNow: 0
        }
      })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Get statistics error:', error)
    // Return default statistics
    return NextResponse.json({ 
      data: {
        totalCalls: 0,
        successRate: '0',
        avgDuration: 0,
        activeCallsNow: 0
      }
    })
  }
}