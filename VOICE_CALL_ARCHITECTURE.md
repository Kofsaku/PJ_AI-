# 音声通話アーキテクチャ詳細

このドキュメントは、AI Call System における主要機能「音声通話」の仕組みをエンジニア向けに整理したものです。バックエンド、Twilio Webhook、会話エンジン、リアルタイム連携にフォーカスして説明します。

## 1. 全体構成

```
顧客 ↔ Twilio Voice Platform ↔ Express API (/api/twilio/*) ↔ 会話エンジン ↔ MongoDB
                                        ↘ WebSocket ↔ Next.js ダッシュボード
```

- **通話セッション管理**: `backend/models/CallSession.js` が MongoDB 上で通話状態・録音情報・ハンドオフ等を一元管理。
- **AI会話制御**: `backend/services/conversationEngine.js` がテンプレート、状態遷移、意図判定を担当。
- **音声合成**: `backend/services/coefontService.js` が CoeFont API を利用して TwiML 用の音声 URL を生成。
- **リアルタイム通知**: `backend/services/websocket.js` が Socket.IO を初期化しフロントへ通話イベントを配信。

## 2. アウトバウンド通話フロー

1. `POST /api/calls/start` (`backend/controllers/callController.js`) が発火。
   - `Customer` と `AgentSettings` を取得し、テンプレート情報を `CallSession.aiConfiguration` に格納。
   - `CallSession` を `status: initiated` で作成し、暫定的な `twilioCallSid` を設定。
2. Twilio REST API `client.calls.create` で顧客へ発信。
   - `url` に `/api/twilio/voice/conference/:callId` を指定。
   - `statusCallback` に `/api/twilio/call/status/:callId` を登録して状態更新を受領。
   - 録音開始 (`record: true`) と録音ステータスコールバック `/api/twilio/recording/status/:callId` を設定。
3. 通話生成後、Twilio からの `call.sid` で `CallSession.twilioCallSid` を確定し、`status: ai-responding` に更新。
4. WebSocket (`global.io.emit('call-started')`) でダッシュボードに通知し、UI の「通話中」表示へ反映。

## 3. インバウンド通話フロー

1. Twilio 電話番号に着信すると、Voice Webhook が `/api/twilio/voice` (`backend/controllers/twilioVoiceController.js`) を呼び出す。
2. 発信者番号 (`From`) を日本国内形式へ変換後、既存顧客を検索。存在しなければ `Customer` を自動生成。
3. `CallSession` を `status: in-progress` で作成または更新し、関連エージェントのテンプレートを `aiConfiguration` に格納。
4. 応答遅延を避けるため、TwiML は即座に `/api/twilio/voice/conference/:callId` へリダイレクト。
5. `setImmediate` で非同期に会話エンジン初期化、WebSocket 通知、通話タイムアウト監視の開始 (`callTimeoutManager.startCallTimeout`) を実行。

## 4. TwiML 生成と会議接続

- `generateConferenceTwiML` (`backend/controllers/twilioController.js`) が Twilio へ返却する TWiML を生成。
  - `<Gather>` で日本語音声認識 (`input: speech`, `language: ja-JP`) と部分結果コールバックを設定。
  - `coefontService.getTwilioPlayElement` により初回挨拶メッセージを CoeFont 音声として即時再生。
  - 会話エンジン (`conversationEngine.initializeConversation`) を非同期で起動し、通話ごとの状態を Map に保持。
- エージェント参加用エンドポイント `/api/twilio/voice/conference/agent/:conferenceName` は、CoeFont で案内後 `<Dial><Conference>` で会議に接続。エージェント退室時に `endConferenceOnExit` により会議を終了。

## 5. 音声認識と応答生成

- `<Gather action>` で呼ばれる `/api/twilio/voice/gather/:callId` (`twilioController.handleSpeechInput`) が speech-to-text 結果を処理。
  - `CallSession` を取得し、会話エンジンが未初期化なら即初期化。
  - 無音判定・聞き返し回数をカウントし、条件に応じたテンプレート発話を生成。
  - `conversationEngine.generateResponse` が意図判定（`responsePatterns`）と状態遷移（`conversationStates`）を行い、次アクションを決定。
  - 応答は再度 `<Gather>` として返し、CoeFont 音声を再生。
- 部分的な認識結果は `/api/twilio/voice/partial/:callId` で受け取り、`webSocketService.broadcastCallEvent('partial-transcript', ...)` を通じてリアルタイム表示に利用。

## 6. 通話ステータス更新と通知

- Twilio からのステータス更新は `/api/twilio/call/status/:callId`（`routes/twilioRoutes.js`）に届く。
  - `CallStatus` に応じて `CallSession.status`、`endReason`、`callResult`、`endTime` を更新し、必要に応じて顧客の最終通話日・結果を更新。
  - `webSocketService.broadcastCallEvent('call-status', ...)` で Next.js ダッシュボードへリアルタイム配信。
  - 通話終了時は `conversationEngine.clearConversation` と `callTimeoutManager.clearCallTimeout` を呼び出し状態を解放。
- 録音完了イベント `/api/twilio/recording/status/:callId` は `CallSession.recordingSid` / `recordingUrl` を保存し、ダウンロードリンクを後続処理で利用可能。

## 7. ハンドオフとカンファレンス管理

- `POST /api/calls/:callId/handoff` (`callController.js`) が人間オペレーターへの転送を開始。
  - 対象エージェントの国際電話番号を取得し、Twilio Conference にダイヤル。
  - `CallSession.handoffDetails` に理由・接続時刻・参加 SID を記録。
  - エージェント参加状況は `/api/twilio/conference/agent-events` で監視し、退室時に会議終了。
- 直接ハンドオフ用の `/api/direct/*` ルートも存在し、認証不要で特定番号に接続可能。

## 8. 音声合成 (CoeFont) の扱い

- `coefontService.getTwilioPlayElement(twiml, text)` は以下を実行：
  1. CoeFont API で音声ファイルを生成し、一時 URL を取得。
  2. TwiML の `<Play>` 要素として URL を挿入。
  3. 失敗時は Amazon Polly (`<Say voice="Polly.Mizuki">`) にフォールバック。
- 初回挨拶、無音確認、謝罪、エラー応答など全パターンをテンプレート化し、`AgentSettings.processTemplate(key)` で企業/担当者固有の文言に差し替え。

## 9. 会話エンジン詳細

- `conversationEngine` の主な責務：
  - **状態管理**: 通話ごとに `Map<callId, state>` を保持。`currentPhase` や `conversationState` を遷移させ、無音回数・聞き返し制限を管理。
  - **意図判定**: `responsePatterns` で日本語キーワードをマッチングし、`intent / confidence / nextAction` を決定。
  - **テンプレート適用**: `AgentSettings` で定義されたテンプレートを埋め込み、CoeFont に渡す文章を生成。
  - **ハンドオフ判定**: `shouldHandoff` フラグや `handoffReason` を設定し、必要に応じて人間オペレーターへ誘導。
  - **結果確定**: 通話終了時に `determineCallResult`（`twilioController.js`）を呼び出し、`CallSession.callResult` を `成功/不在/拒否/要フォロー/失敗` のいずれかに確定。

## 10. WebSocket とリアルタイム監視

- `backend/services/websocket.js` が Socket.IO を初期化し、トークン認証（開発環境ではスキップ）を実装。
- 通話イベントは以下のように分類：
  - `call-status`: 通話状態（calling / in-progress / completed 等）
  - `call-ended`: 終了詳細（duration, endReason, callResult）
  - `partial-transcript` / `full-transcript`: 逐次/最終の文字起こし
- フロント (`frontend/app/dashboard/page.tsx` 等) は `call-status` を受信して顧客行に「通話中」バッジを表示し、`CallStatusModal` で詳細モニタリングを提供。

## 11. タイムアウトとクリーンアップ

- `callTimeoutManager` が通話開始時に `setTimeout` を登録し、既定時間（例: 15分）無応答の場合に強制終了処理を行う。
- `cleanup-calls.js` と `bulkCallController.cleanupOldSessions` が定期的に古いセッションを削除し、DB とメモリの整合性を保つ。

## 12. 環境変数とセットアップ

- Twilio: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, 発信用番号 (`TWILIO_PHONE_NUMBER_DEV` 等)。
- Webhook ベース URL: `BASE_URL`（ngrok や本番ドメインを指定）。
- CoeFont: `COEFONT_ACCESS_KEY`, `COEFONT_CLIENT_SECRET`。
- OpenAI や MongoDB 接続情報は `backend/.env` に設定。Twilio Console の Voice Webhook を `https://<BASE_URL>/api/twilio/voice` に設定すること。

## 13. ローカル検証手順

1. `./start-dev.sh` でバックエンド・フロントを起動（MongoDB も起動しておく）。
2. `ngrok http 5001` を実行し、表示された HTTPS URL を `backend/.env` の `BASE_URL` および Twilio コンソールに設定。
3. 管理画面 (`http://localhost:3000/admin`) から顧客を選択しアウトバウンド発信。また、Twilio 番号へ直接着信してインバウンドフローを確認。
4. ダッシュボードの WebSocket バッジや `CallStatusModal` のリアルタイム更新、録音 URL、通話結果を確認。

## 14. 留意事項・拡張ポイント

- `CallSession.twilioCallSid` は複数の `null` を許容するため `sparse: true` を付与。
- 会話状態はプロセス内メモリに保持されるため、スケールアウト時は外部ストア（Redis 等）への移行が必要。
- CoeFont API がタイムアウトする場合に備え、Polly へのフォールバックを必ずテストする。
- Twilio 側のステータス文字列が追加された場合、`/api/twilio/call/status/:callId` の判定ロジックに追随すること。
- ハンドオフ機能を利用する場合、エージェントの電話番号が国際形式で登録されていることを確認。

---
このドキュメントに記載されたエンドポイントやサービスの詳細なコードは、それぞれのファイル（`backend/controllers/*`, `backend/services/*`, `backend/models/*`）を参照してください。
