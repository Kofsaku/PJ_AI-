import { WebSocketServer } from 'ws';
import { NextResponse } from 'next/server';
import twilio from 'twilio';

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// WebSocketサーバーの設定
const wss = new WebSocketServer({ port: 3000 });

wss.on('connection', (ws) => {
  console.log('クライアントが接続しました');

  ws.on('message', async (message) => {
    const messageStr = message.toString();
    console.log('受信メッセージ:', messageStr);
    
    if (messageStr === 'intervene') {
      try {
        // 現在の通話を取得
        const calls = await client.calls.list({ status: 'in-progress' });
        if (calls.length > 0) {
          const callSid = calls[0].sid;
          // 通話を人間に転送
          await client.calls(callSid)
            .update({
              url: "https://7ceb-240d-1a-a24-cf00-6ce3-82a1-3b64-583a.ngrok-free.app/api/twilio/voice/connect/operator",
              method: 'POST'
            });
          console.log('通話が人間に転送されました:', callSid);
        } else {
          console.log('進行中の通話が見つかりません');
        }
      } catch (error) {
        console.error('通話転送エラー:', error);
      }
    }
  });

  ws.on('close', () => {
    console.log('クライアントが切断しました');
  });
});

export async function GET() {
  return new NextResponse('WebSocket Server is running');
} 