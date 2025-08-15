import { NextResponse } from 'next/server';

// WebSocket機能はバックエンドサーバーで処理されます
// このエンドポイントはWebSocketの接続情報を提供するだけです
export async function GET() {
  return NextResponse.json({
    message: 'WebSocket connections should be made to the backend server',
    wsUrl: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:5001'
  });
} 