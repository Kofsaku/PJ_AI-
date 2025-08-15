import { NextResponse } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000'

export async function GET() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/calls/active`, {
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      // If backend returns 404 or error, return empty array for now
      if (response.status === 404) {
        return NextResponse.json({ data: [] })
      }
      throw new Error(`Backend responded with status: ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Get active calls error:', error)
    // Return empty array instead of error to prevent UI crash
    return NextResponse.json({ data: [] })
  }
}