import { NextResponse } from "next/server";
import twilio from "twilio";

interface TwilioError {
  code: number;
  message: string;
  status: number;
  details?: any;
}

export async function POST() {
  try {
    // 環境変数のチェック
    if (!process.env.TWILIO_ACCOUNT_SID) {
      console.error("TWILIO_ACCOUNT_SID is not set");
      return NextResponse.json(
        { error: "TwilioアカウントSIDが設定されていません" },
        { status: 500 }
      );
    }

    if (!process.env.TWILIO_AUTH_TOKEN) {
      console.error("TWILIO_AUTH_TOKEN is not set");
      return NextResponse.json(
        { error: "Twilio認証トークンが設定されていません" },
        { status: 500 }
      );
    }

    if (!process.env.TWILIO_PHONE_NUMBER) {
      console.error("TWILIO_PHONE_NUMBER is not set");
      return NextResponse.json(
        { error: "Twilio電話番号が設定されていません" },
        { status: 500 }
      );
    }

    const client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );

    const to = "+818070239355";
    const from = process.env.TWILIO_PHONE_NUMBER;
    const baseUrl = process.env.NGROK_URL || "http://localhost:3000";
    const url = `${baseUrl}/api/twilio/voice`;
    const statusCallback = `${baseUrl}/api/twilio/status`;

    console.log("Making call with:", { to, from, url, statusCallback });

    try {
      const call = await client.calls.create({
        to,
        from,
        url,
        statusCallback,
        statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
      });

      console.log("Call created successfully:", call.sid);
      return NextResponse.json({ success: true, callSid: call.sid });
    } catch (error) {
      const twilioError = error as TwilioError;
      console.error("Twilio API error:", {
        code: twilioError.code,
        message: twilioError.message,
        status: twilioError.status,
        details: twilioError.details,
      });
      throw twilioError;
    }
  } catch (error) {
    console.error("Detailed error making call:", error);
    const errorMessage =
      error instanceof Error ? error.message : "不明なエラー";
    const errorCode =
      error instanceof Error && "code" in error
        ? (error as any).code
        : undefined;

    return NextResponse.json(
      {
        error: "通話の開始に失敗しました",
        details: errorMessage,
        code: errorCode,
      },
      { status: 500 }
    );
  }
}
