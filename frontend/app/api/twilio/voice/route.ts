// app/api/twilio/voice/route.ts
import { NextResponse } from "next/server"
import twilio from "twilio"

const VoiceResponse = twilio.twiml.VoiceResponse

/**
 * Twilioが通話開始時にアクセスしてくるURL
 * → TWiML (XML) を返す
 */
export async function GET() {
  return voiceResponse()
}

export async function POST(request: Request) {
  return voiceResponse()
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
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0"
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
