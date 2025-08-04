import { NextResponse } from "next/server"
import twilio from "twilio"

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const callSid = searchParams.get("callSid")

    if (!callSid) {
      return NextResponse.json(
        { error: "通話IDが必要です" },
        { status: 400 }
      )
    }

    const call = await client.calls(callSid).fetch()
    return NextResponse.json({ status: call.status })
  } catch (error) {
    console.error("Error checking call status:", error)
    return NextResponse.json(
      { error: "通話状態の確認に失敗しました" },
      { status: 500 }
    )
  }
} 