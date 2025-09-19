// app/api/twilio/voice/route.ts
import { NextResponse } from "next/server"

/**
 * This route is deprecated. Twilio voice handling should go through the backend.
 * Redirecting to backend ngrok URL.
 */
// Node.js Runtime指定（Vercel Edge Runtime回避）
export const runtime = 'nodejs'

export async function GET() {
  console.log('GET request received from Twilio - redirecting to backend')
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:5001'
  return NextResponse.redirect(`${backendUrl}/api/twilio/voice`, 302)
}

export async function POST(request: Request) {
  console.log('POST request received from Twilio - redirecting to backend')
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:5001'
  
  // Forward the request to backend
  try {
    const body = await request.text()
    const response = await fetch(`${backendUrl}/api/twilio/voice`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body
    })
    
    const twiml = await response.text()
    return new NextResponse(twiml, {
      status: 200,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
      },
    })
  } catch (error) {
    console.error('Error forwarding to backend:', error)
    // Return empty TwiML on error
    return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      status: 200,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
      },
    })
  }
}

// Handle OPTIONS request for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "*"
    }
  })
}
