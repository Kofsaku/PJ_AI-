import { NextResponse } from "next/server";
import twilio from "twilio";

const VoiceResponse = twilio.twiml.VoiceResponse;

export async function POST(request: Request) {
  const formData = await request.formData();
  const callSid = formData.get("CallSid")?.toString() || "";

  if (!callSid) {
    console.warn("CallSid が取得できませんでした。");
    return new NextResponse("CallSid required", { status: 400 });
  }

  const operatorNumber = process.env.NEXT_PUBLIC_HUMAN_REPRESENTATIVE_NUMBER;
  if (!operatorNumber) {
    console.error("オペレーターの電話番号が設定されていません。");
    return new NextResponse("Operator phone number not set", { status: 500 });
  }

  const response = new VoiceResponse();
  
  // オペレーターへの接続メッセージ
  response.say(
    { voice: "Polly.Mizuki-Neural", language: "ja-JP" },
    "担当者にお繋ぎいたします。少々お待ちください。"
  );

  // オペレーターとの通話を開始
  response.dial({
    callerId: process.env.TWILIO_PHONE_NUMBER,
    record: 'record-from-answer',
    recordingStatusCallback: `${process.env.NGROK_URL}/api/twilio/recording`,
    recordingStatusCallbackEvent: ['completed'],
    recordingStatusCallbackMethod: 'POST'
  }, operatorNumber);

  const twiml = response.toString();
  console.log("=== 生成されたTwiML（オペレーター） ===");
  console.log(twiml);
  console.log("=====================");

  return new NextResponse(twiml, {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8" }
  });
} 