import { NextResponse } from 'next/server';
import twilio from 'twilio';

export async function POST() {
  try {
    console.log('=== オペレーター接続処理開始 ===');
    console.log('タイムスタンプ:', new Date().toISOString());

    const twiml = new twilio.twiml.VoiceResponse();
    console.log('VoiceResponseオブジェクト作成完了');

    const dial = twiml.dial({
      callerId: process.env.TWILIO_PHONE_NUMBER,
      timeout: 180,
      record: 'record-from-answer',
      recordingStatusCallback: `${process.env.NGROK_URL}/api/twilio/voice/recording-status`,
      recordingStatusCallbackEvent: ['completed'],
      recordingStatusCallbackMethod: 'POST',
      answerOnBridge: true,
      referUrl: `${process.env.NGROK_URL}/api/twilio/voice/status`,
      hangupOnStar: false,
      timeLimit: 3600,
      sequential: true,
      machineDetection: 'Enable',
      machineDetectionTimeout: 30,
      machineDetectionUrl: `${process.env.NGROK_URL}/api/twilio/voice/machine-detection`,
      machineDetectionMethod: 'POST'
    });

    console.log('Dial設定完了:', {
      callerId: process.env.TWILIO_PHONE_NUMBER,
      timeout: 180,
      record: 'record-from-answer',
      recordingStatusCallback: `${process.env.NGROK_URL}/api/twilio/voice/recording-status`,
      answerOnBridge: true,
      referUrl: `${process.env.NGROK_URL}/api/twilio/voice/status`,
      hangupOnStar: false,
      timeLimit: 3600,
      sequential: true,
      machineDetection: 'Enable',
      machineDetectionTimeout: 30,
      machineDetectionUrl: `${process.env.NGROK_URL}/api/twilio/voice/machine-detection`,
      machineDetectionMethod: 'POST'
    });

    const client = dial.client('operator');
    console.log('クライアント設定完了:', {
      client: 'operator',
      timestamp: new Date().toISOString()
    });

    // クライアントパラメータの設定
    client.parameter({
      name: 'statusCallback',
      value: `${process.env.NGROK_URL}/api/twilio/voice/status`
    });
    client.parameter({
      name: 'statusCallbackEvent',
      value: 'initiated ringing answered completed'
    });
    client.parameter({
      name: 'statusCallbackMethod',
      value: 'POST'
    });
    client.parameter({
      name: 'timeout',
      value: '180'
    });
    client.parameter({
      name: 'timeLimit',
      value: '3600'
    });
    client.parameter({
      name: 'answerOnBridge',
      value: 'true'
    });
    client.parameter({
      name: 'sequential',
      value: 'true'
    });
    client.parameter({
      name: 'machineDetection',
      value: 'Enable'
    });
    client.parameter({
      name: 'machineDetectionTimeout',
      value: '30'
    });
    console.log('クライアントパラメータ設定完了');

    const response = twiml.toString();
    console.log('生成されたTwiML:', response);

    return new Response(response, {
      headers: {
        'Content-Type': 'text/xml',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error('=== オペレーター接続エラー ===');
    console.error('エラー詳細:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });

    // エラー時のTwiMLを生成
    const errorTwiml = new twilio.twiml.VoiceResponse();
    errorTwiml.say({
      voice: 'Polly.Mizuki-Neural',
      language: 'ja-JP'
    }, '申し訳ありません。接続に問題が発生しました。');

    return new Response(errorTwiml.toString(), {
      headers: {
        'Content-Type': 'text/xml',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  }
} 