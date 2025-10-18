# OpenAI Realtime API統合提案

## Why

現在のシステムは、音声認識・会話処理・音声合成を個別のサービス（Twilio音声認識、ConversationEngine、Coefont TTS）で実行しており、以下の問題があります：

1. **音声認識精度の低さ**: Twilioの音声認識は日本語の精度が低く、誤認識が頻発する
2. **レスポンスの遅延**: 各ステップで処理が分離されており、CoeFont音声合成に500-2000msかかる
3. **会話の自然さの欠如**: ルールベースのConversationEngineではキーワードマッチングに依存し、文脈理解が不十分
4. **メンテナンスの複雑性**: 3つの異なるサービスの統合管理が必要

**目標**: OpenAI Realtime APIで既存システムを置き換え、電話できるようにする。特別な機能追加は不要。

## What Changes

### Backend Changes（既存システムの置き換え）
- **ADDED**: `services/openaiRealtimeService.js` - WebSocketクライアント実装
- **MODIFIED**: `services/conversationEngine.js` - Realtime APIに処理を委譲
- **REMOVED**: `services/coefontService.js` - OpenAI TTSに置き換え
- **MODIFIED**: `routes/twilioRoutes.js` - Media Streams対応エンドポイント追加
- **MODIFIED**: `services/twilioService.js` - Media Streams対応
- **ADDED**: 環境変数 `OPENAI_REALTIME_API_KEY`

### Configuration Changes（最小限）
- **ADDED**: `backend/.env` に `OPENAI_REALTIME_API_KEY`
- **MODIFIED**: `models/AgentSettings.js` - 既存の`conversationSettings`を保持（プロンプト変換して使用）
- **MODIFIED**: `models/CallSession.js` - `realtimeSessionId`を追加

### **Breaking Changes**
- **BREAKING**: Coefont API依存を完全削除

## Impact

### Affected Specs
- `voice-processing` - 音声認識・合成処理の全面刷新
- `conversation-engine` - ルールベースからGPT-4oベースへ移行
- `twilio-integration` - Media Streams対応追加
- `agent-settings` - 音声設定スキーマ変更

### Affected Code（最小限の変更）
- `backend/services/openaiRealtimeService.js` - 新規作成
- `backend/services/conversationEngine.js` - Realtime APIに委譲
- `backend/services/coefontService.js` - 削除
- `backend/services/twilioService.js` - Media Streams対応
- `backend/routes/twilioRoutes.js` - WebSocket endpoint追加
- `backend/models/CallSession.js` - `realtimeSessionId`追加

### Performance Impact
- **レイテンシ削減**: 500-2000ms → 100-300ms（目標）
- **音声認識精度向上**: 70-80% → 95%+（日本語）

### Migration Strategy（シンプル）
1. 既存の`conversationSettings`は保持し、プロンプト変換して使用
2. **ロールバック**: Gitタグ付けされたコミットに上書きで復元

## Dependencies
- OpenAI Realtime API アクセス権限
- Twilio Media Streams 有効化
- WebSocket対応のサーバー環境（既存のSocket.IOインフラを活用）

## Timeline Estimate
- 実装: 3-5日
- テスト: 1-2日
- **合計: 4-7日**

## Success Criteria（シンプル）
- [ ] Twilioから電話がかかり、Realtime APIで応答できる
- [ ] 日本語音声認識が動作する
- [ ] 既存の通話機能（ハンドオフ、録音）が動作する
- [ ] Gitタグベースのロールバック手順が文書化されている
