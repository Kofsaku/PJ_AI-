# Migrate to OpenAI SIP Integration

## Why

現在の実装では、Twilio Media Streams（WebSocket経由）を使用してOpenAI Realtime APIに音声データを送信していますが、以下の問題が発生しています：

1. **音声が出力されない**: OpenAIからの`response.output_audio.delta`イベントが発生せず、音声応答が生成されていない
2. **音声認識が失敗**: `conversation.item.input_audio_transcription.failed`エラーが発生
3. **サポートされていないアーキテクチャ**: OpenAI Realtime APIは以下の接続方法のみをサポート：
   - WebRTC（ブラウザから直接）
   - WebSocket（PCM/g711音声のBase64エンコード）
   - **SIP（電話システムとの統合）** ← 推奨

Twilio Media Streamsは音声フォーマットとプロトコルがOpenAI Realtime APIの期待値と一致せず、手動で音声変換を実装する必要があるが、複雑で信頼性が低い。

**目標**: OpenAI Realtime API の **SIP統合**に切り替え、電話通話が正常に動作するようにする

## What Changes

### 1. Twilio Voice Response の変更
**現在（Twilio Media Streams）**:
```xml
<Response>
  <Connect>
    <Stream url="wss://backend/api/twilio/media-stream/{callId}"/>
  </Connect>
</Response>
```

**新規（OpenAI SIP転送）**:
```xml
<Response>
  <Dial>
    <Sip>sip:PROJECT_ID@sip.api.openai.com;transport=tls</Sip>
  </Dial>
</Response>
```

### 2. Webhook処理の追加
- OpenAIからの`realtime.call.incoming` webhookを受信
- `/api/openai/webhook/call-incoming`エンドポイントを新規作成
- Webhook検証機能を実装

### 3. Call Accept/Reject APIの実装
- OpenAI Call Accept endpoint: `POST https://api.openai.com/v1/realtime/calls/{call_id}/accept`
- Call Reject endpoint: `POST https://api.openai.com/v1/realtime/calls/{call_id}/reject`

### 4. Sideband WebSocket接続
- `wss://api.openai.com/v1/realtime?call_id={call_id}`に接続
- ツール呼び出しとセッション制御を実行
- 既存の`openaiRealtimeService.js`を活用

### 5. 削除するコード
- `backend/controllers/mediaStreamController.js` - 不要になる
- Twilio Media Streams関連のroutes

## Impact

### Affected Components
- `backend/routes/twilioRoutes.js` - SIP転送TwiMLを返すように変更
- `backend/controllers/twilioVoiceController.js` - Media Streams関連コードを削除、シンプルなSIP転送に変更
- **NEW**: `backend/routes/openaiWebhookRoutes.js` - OpenAI webhook受信
- **NEW**: `backend/controllers/openaiWebhookController.js` - webhook処理とCall Accept
- `backend/services/openaiRealtimeService.js` - sideband接続に特化
- `backend/models/CallSession.js` - `openaiCallId`フィールドを追加
- **DELETE**: `backend/controllers/mediaStreamController.js`

### Configuration Changes
- **NEW**: `OPENAI_PROJECT_ID` - OpenAI project ID（SIPエンドポイント用）
- **NEW**: `OPENAI_WEBHOOK_SECRET` - Webhook署名検証用
- **NEW**: Webhook URL設定（OpenAI Platform）

### Architecture Improvement
**Before (Media Streams)**:
```
Phone → Twilio → Media Streams (WS) → Backend → OpenAI Realtime (WS)
                    ↓
              手動音声変換（複雑で不安定）
```

**After (SIP)**:
```
Phone → Twilio → SIP → OpenAI Realtime API
                          ↓
                    Backend (sideband WS)
                    - Tool calling
                    - Session control
```

## Dependencies
- OpenAI Platform Webhookの設定が必要
- OpenAI Project IDの取得
- Webhook署名検証の実装
- 既存のTwilio設定は維持（電話番号、認証情報）

## Timeline Estimate
- Webhook実装: 2-3時間
- SIP統合とTwiML変更: 1-2時間
- Sideband WebSocket実装: 1-2時間
- テストとデバッグ: 2-3時間
- **合計: 6-10時間（1日）**

## Success Criteria
- [ ] OpenAIからのwebhook `realtime.call.incoming`を正常に受信できる
- [ ] Call Acceptが成功し、Realtime sessionが確立される
- [ ] 電話で音声が聞こえる（OpenAIの応答が再生される）
- [ ] 日本語音声認識が動作する
- [ ] ツール呼び出し（sideband経由）が動作する
- [ ] 既存の通話機能（録音、トランスクリプト保存）が動作する

## Rollback Strategy
既存のTwilio Media Streams実装は削除せず、環境変数フラグ`USE_OPENAI_SIP`で切り替え可能にする：
- `USE_OPENAI_SIP=true`: 新SIP統合を使用
- `USE_OPENAI_SIP=false`: 旧Media Streams実装を使用（デフォルト）

ロールバック時は`.env`で`USE_OPENAI_SIP=false`に設定するだけ。
