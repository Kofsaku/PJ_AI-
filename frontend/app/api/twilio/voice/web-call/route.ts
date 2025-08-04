import { NextResponse } from "next/server";
import twilio from "twilio";

const VoiceResponse = twilio.twiml.VoiceResponse;

export async function POST(request: Request) {
  const formData = await request.formData();
  const callSid = formData.get("CallSid")?.toString() || "";
  const parentCallSid = formData.get("ParentCallSid")?.toString() || "";

  if (!callSid) {
    console.warn("CallSid が取得できませんでした。");
    return new NextResponse("CallSid required", { status: 400 });
  }

  console.log("=== ウェブコール切り替え処理開始 ===");
  console.log("CallSid:", callSid);
  console.log("ParentCallSid:", parentCallSid);

  const response = new VoiceResponse();
  
  // ウェブコールへの切り替えメッセージ
  response.say(
    { voice: "Polly.Mizuki-Neural", language: "ja-JP" },
    "ウェブコールに切り替えます。少々お待ちください。"
  );

  // ウェブコールの設定
  const dial = response.dial({
    callerId: process.env.TWILIO_PHONE_NUMBER,
    record: 'record-from-answer',
    recordingStatusCallback: `${process.env.NGROK_URL}/api/twilio/recording`,
    recordingStatusCallbackEvent: ['completed'],
    recordingStatusCallbackMethod: 'POST'
  });

  // Webクライアントへの接続
  dial.client('human_operator', {
    statusCallback: `${process.env.NGROK_URL}/api/twilio/voice/status`,
    statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
    statusCallbackMethod: 'POST'
  });

  const twiml = response.toString();
  console.log("=== 生成されたTwiML（ウェブコール） ===");
  console.log(twiml);
  console.log("=====================");

  return new NextResponse(twiml, {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8" }
  });
} 