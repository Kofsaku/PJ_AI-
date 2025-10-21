# 実装タスク

## 1. 環境設定と依存関係
- [x] 1.1 `.env.example`と`.env`に`OPENAI_REALTIME_API_KEY`を追加
- [x] 1.2 npmパッケージをインストール: `openai` SDK（最新GAバージョン）
- [x] 1.3 `backend/package.json`の依存関係を更新

## 2. バックエンド - OpenAI Realtimeサービス（GA API）
- [x] 2.1 `backend/services/openaiRealtimeService.js`を作成
  - [x] `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime`へのWebSocketクライアント接続
  - [x] `session.update`イベントでセッション初期化
  - [x] 音声フォーマット設定（Twilio µ-law ⇔ OpenAI g711_ulaw）
  - [x] エラーハンドリングと再接続ロジック
- [x] 2.2 双方向音声ストリーミングを実装
  - [x] Twilio Media Streamsから音声を受信
  - [x] `input_audio_buffer.append`でOpenAIに転送
  - [x] イベント処理（`audio.delta`、`text.done`、`transcription`等）
  - [x] OpenAIレスポンスをTwilioにストリーム配信
- [x] 2.3 セッションライフサイクル管理
  - [x] `connect(config)` - 初期化
  - [x] `sendAudio(audioData)` - 音声ストリーム
  - [x] `disconnect()` - クリーンアップ

## 3. バックエンド - Twilio統合の更新
- [x] 3.1 `routes/twilioRoutes.js`を修正
  - [x] `/api/twilio/media-stream` WebSocketエンドポイントを追加
  - [x] `controllers/mediaStreamController.js`を作成
- [x] 3.2 `server.js`を更新
  - [x] WebSocketアップグレード処理を追加
  - [x] Media StreamsハンドラーをWebSocketに接続
- [x] 3.3 `controllers/twilioVoiceController.js`を更新
  - [x] `USE_OPENAI_REALTIME`フラグで分岐処理
  - [x] Media Streams用の`<Connect><Stream>`TwiMLを生成

## 4. バックエンド - ConversationEngineの置き換え
- [x] 4.1 `mediaStreamController.js`でRealtime API統合
  - [x] システムプロンプト生成機能を実装
  - [x] `conversationSettings`からプロンプトを自動生成
- [x] 4.2 既存の会話設定をシステムプロンプトに変換
  - [x] AgentSettingsから会話設定を読み込み
  - [x] プロンプト形式に変換して使用

## 5. バックエンド - モデルとスキーマの最小限更新
- [x] 5.1 `models/AgentSettings.js`を更新
  - [x] **既存の`conversationSettings`をそのまま保持**
  - [x] Realtimeで使用する際はプロンプト変換して利用
- [x] 5.2 `models/CallSession.js`を更新
  - [x] `realtimeSessionId` Stringを追加（セッション追跡用）

## 6. バックエンド - Coefont依存の削除
- [ ] 6.1 `services/coefontService.js`を削除（従来モードで使用中のため保留）
- [ ] 6.2 コントローラーからCoefont API呼び出しを削除（従来モードで使用中のため保留）

## 7. テストと検証
- [ ] 7.1 基本動作テスト
  - [ ] Twilio Media Streamsを使用したエンドツーエンド通話
  - [ ] 音声認識と応答が正常に動作することを確認
  - [ ] オペレーターハンドオフが動作することを確認
- [ ] 7.2 レイテンシ確認
  - [ ] エンドツーエンド応答時間を測定（目標: <500ms）

## 8. ドキュメントとロールアウト
- [ ] 8.1 README.mdを更新
  - [ ] OpenAI Realtime API GAセットアップ手順を追加
  - [ ] 新しい環境変数をドキュメント化
- [x] 8.2 CLAUDE.mdを更新
  - [x] Realtime API使用方法を記載
  - [x] 2つのモード（Realtime/従来）を記載
- [ ] 8.3 ロールバック手順をドキュメント化
  - [ ] **Gitタグにロールバック**: タグ付けされたコミットに上書きで復元

## 9. モニタリング（最小限）
- [x] 9.1 基本ロギングを追加
  - [x] セッション開始/終了
  - [x] エラー（WebSocket接続失敗、音声ストリーミングエラー）
  - [x] トランスクリプト記録（音声認識結果、AI応答）
