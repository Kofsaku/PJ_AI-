import { NextResponse } from 'next/server';
import twilio from 'twilio';

const VoiceResponse = twilio.twiml.VoiceResponse;

export async function POST(request: Request) {
  try {
    console.log('=== Stream Endpoint Called ===');
    
    const response = new VoiceResponse();
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pj-ai-2t27-olw2j2em4-kofsakus-projects.vercel.app';
    
    // Start by playing the initial greeting
    response.say({
      voice: "Polly.Mizuki",
      language: "ja-JP"
    }, "お世話になります。わたくしＡＩコールシステムの安達といいますが、");
    
    // Start a streaming connection for continuous conversation
    const start = response.start();
    start.stream({
      url: `wss://${new URL(baseUrl).hostname}/api/twilio/websocket`,
      track: 'both_tracks'
    });
    
    // After starting the stream, use gather for continuous interaction
    response.gather({
      input: ["speech"],
      language: "ja-JP",
      speechTimeout: "auto",
      action: `${baseUrl}/api/twilio/voice/response?state=initial`,
      method: "POST",
      timeout: 10,
      partialResultCallback: `${baseUrl}/api/twilio/voice/partial`,
      partialResultCallbackMethod: "POST"
    });
    
    // Pause to keep the call alive
    response.pause({ length: 60 });
    
    const twiml = response.toString();
    console.log("Generated Stream TwiML:", twiml);
    
    return new NextResponse(twiml, {
      status: 200,
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "Cache-Control": "no-cache, no-store, must-revalidate"
      }
    });
  } catch (error) {
    console.error("Error in stream endpoint:", error);
    const errorResponse = new VoiceResponse();
    errorResponse.say({
      voice: "Polly.Mizuki",
      language: "ja-JP"
    }, "申し訳ありません。接続に問題が発生しました。");
    
    return new NextResponse(errorResponse.toString(), {
      status: 200,
      headers: {
        "Content-Type": "text/xml; charset=utf-8"
      }
    });
  }
}