import { NextResponse } from "next/server"
import twilio from "twilio"

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const client = twilio(accountSid, authToken)

export async function GET() {
  try {
    const token = new twilio.jwt.AccessToken(
      accountSid!,
      authToken!,
      process.env.TWILIO_PHONE_NUMBER!,
      { identity: "ai-call-user" }
    )

    const VoiceGrant = new twilio.jwt.AccessToken.VoiceGrant({
      outgoingApplicationSid: process.env.TWILIO_APP_SID,
      incomingAllow: true,
      pushCredentialSid: undefined
    })

    token.addGrant(VoiceGrant)

    return NextResponse.json({ token: token.toJwt() })
  } catch (error) {
    console.error("Error generating token:", error)
    return NextResponse.json({ error: "Failed to generate token" }, { status: 500 })
  }
} 