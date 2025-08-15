// app/api/twilio/voice/route.ts
import { NextResponse } from "next/server"
import twilio from "twilio"

const VoiceResponse = twilio.twiml.VoiceResponse

/**
 * Twilioが通話開始時にアクセスしてくるURL
 * → TWiML (XML) を返す
 */
export async function GET() {
  console.log('GET request received from Twilio')
  return voiceResponse()
}

export async function POST(request: Request) {
  console.log('POST request received from Twilio')
  
  // Log request headers for debugging
  const headers = Object.fromEntries(request.headers.entries())
  console.log('Request headers:', headers)
  
  // Log request body
  try {
    const body = await request.text()
    console.log('Request body:', body)
    // Reset the request for further processing if needed
    request = new Request(request.url, {
      method: request.method,
      headers: request.headers,
      body: body
    })
  } catch (error) {
    console.error('Error reading request body:', error)
  }
  
  return voiceResponse()
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

// 実際の処理をまとめる
function voiceResponse() {
  try {
    const response = new VoiceResponse()
    
    // 1. アプリが初めの挨拶をする
    response.say({
      voice: "Polly.Mizuki",
      language: "ja-JP"
    }, "お世話になります。わたくしＡＩコールシステムの安達といいますが、")

    // 2. ユーザーの入力を待つ
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pj-ai-2t27-olw2j2em4-kofsakus-projects.vercel.app'
    response.gather({
      input: ["speech"],
      language: "ja-JP",
      speechTimeout: "auto",
      action: `${baseUrl}/api/twilio/voice/response?state=initial`,
      method: "POST",
      timeout: 5
    })

    const twiml = response.toString()
    console.log("Generated TwiML:", twiml)

    return new NextResponse(twiml, {
      status: 200,
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "*"
      },
    })
  } catch (error) {
    console.error("Error generating TwiML:", error)
    return new NextResponse("", {
      status: 200,
      headers: {
        "Content-Type": "text/xml",
      },
    })
  }
}
