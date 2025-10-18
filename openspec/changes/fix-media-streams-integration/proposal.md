# Fix OpenAI Realtime API Media Streams Integration

## Why

The current `migrate-to-openai-sip` approach is **fundamentally incorrect**. After analyzing [Twilio's official sample implementation](https://github.com/twilio-samples/speech-assistant-openai-realtime-api-python), we discovered:

1. **OpenAI Realtime API + Twilio uses Media Streams, NOT SIP**
   - Official sample uses `<Connect><Stream>` TwiML, not `<Dial><Sip>`
   - Backend acts as WebSocket bridge between Twilio Media Streams and OpenAI Realtime API
   - Audio flows through backend (base64-encoded μ-law/g.711 format)

2. **Our current Media Streams implementation has critical flaws**:
   - Missing audio format specification (`audio/pcmu` required)
   - Incorrect session initialization (should use `session.update` message)
   - No proper turn detection configuration
   - Missing interrupt handling logic

3. **SIP integration is completely wrong for this use case**:
   - SIP is for direct phone-to-OpenAI connections (different API endpoint)
   - SIP doesn't support tool calling or custom session control
   - SIP requires OpenAI Project ID and webhook infrastructure that isn't needed for Media Streams

**Goal**: Fix the existing Media Streams implementation based on Twilio's official best practices

## What Changes

### Architecture (CORRECT approach)
```
Phone → Twilio → Media Streams (WS) → Backend (WS bridge) → OpenAI Realtime API (WS)
                    ↓
                audio/pcmu (μ-law)
                base64-encoded
```

### 1. Fix TwiML Response (Keep Media Streams)
**Current** (CORRECT, no change needed):
```xml
<Response>
  <Connect>
    <Stream url="wss://backend/api/twilio/media-stream/{callId}"/>
  </Connect>
</Response>
```

**Remove** (WRONG approach):
```xml
<Response>
  <Dial>
    <Sip>sip:PROJECT_ID@sip.api.openai.com;transport=tls</Sip>
  </Dial>
</Response>
```

### 2. Fix OpenAI Session Initialization

**Official Sample** (CORRECT):
```javascript
// Send session.update message after WebSocket connection
const sessionUpdate = {
  type: "session.update",
  session: {
    type: "realtime",
    model: "gpt-realtime",
    output_modalities: ["audio"],
    audio: {
      input: {
        format: { type: "audio/pcmu" },  // μ-law format
        turn_detection: { type: "server_vad" }
      },
      output: {
        format: { type: "audio/pcmu" },  // μ-law format
        voice: "alloy"
      }
    },
    instructions: "..."
  }
};
await openai_ws.send(JSON.stringify(sessionUpdate));
```

**Current** (INCORRECT):
- No audio format specification
- Missing turn detection configuration
- Using Accept API instead of session.update message

### 3. Audio Data Flow

**Twilio → OpenAI**:
```javascript
// Twilio sends: { event: "media", media: { payload: "<base64>" } }
const audioAppend = {
  type: "input_audio_buffer.append",
  audio: data.media.payload  // Already base64-encoded μ-law
};
await openai_ws.send(JSON.stringify(audioAppend));
```

**OpenAI → Twilio**:
```javascript
// OpenAI sends: { type: "response.output_audio.delta", delta: "<base64>" }
const audioEvent = {
  event: "media",
  streamSid: stream_sid,
  media: {
    payload: response.delta  // Base64-encoded μ-law
  }
};
await twilio_ws.send(JSON.stringify(audioEvent));
```

### 4. Interrupt Handling

```javascript
// When user starts speaking
if (response.type === 'input_audio_buffer.speech_started') {
  // Clear Twilio buffer
  await twilio_ws.send(JSON.stringify({
    event: "clear",
    streamSid: stream_sid
  }));

  // Truncate OpenAI response
  await openai_ws.send(JSON.stringify({
    type: "conversation.item.truncate",
    item_id: last_assistant_item,
    content_index: 0,
    audio_end_ms: elapsed_time
  }));
}
```

## Impact

### Affected Components
- `backend/controllers/mediaStreamController.js` - Fix session initialization and audio format
- `backend/services/openaiRealtimeService.js` - Add interrupt handling
- `backend/controllers/twilioVoiceController.js` - Keep Media Streams TwiML (no change)
- **DELETE**: All SIP-related code added in `migrate-to-openai-sip`
  - `backend/routes/openaiWebhookRoutes.js`
  - `backend/controllers/openaiWebhookController.js`
  - `backend/services/openaiSidebandService.js`

### Configuration Changes
- **REMOVE**: `USE_OPENAI_SIP` (not needed)
- **REMOVE**: `OPENAI_PROJECT_ID` (not needed)
- **REMOVE**: `OPENAI_WEBHOOK_SECRET` (not needed)
- **KEEP**: `USE_OPENAI_REALTIME` (feature flag for Realtime API)
- **KEEP**: `OPENAI_REALTIME_API_KEY`

### Architecture Comparison

**WRONG (migrate-to-openai-sip)**:
```
Phone → Twilio → SIP → OpenAI Realtime API
                          ↓
                    Backend (sideband WS)
```

**CORRECT (fix-media-streams-integration)**:
```
Phone → Twilio → Media Streams (WS) → Backend (WS bridge) → OpenAI Realtime API (WS)
```

## Dependencies
- Reference implementation: [Twilio official sample](https://github.com/twilio-samples/speech-assistant-openai-realtime-api-python)
- Working Media Streams infrastructure (already exists)
- OpenAI Realtime API access (already configured)

## Timeline Estimate
- Remove SIP code: 30 minutes
- Fix session initialization: 1 hour
- Add audio format configuration: 1 hour
- Implement interrupt handling: 2 hours
- Testing and debugging: 2 hours
- **Total: 6-7 hours**

## Success Criteria
- [ ] OpenAI session initializes with `session.update` message
- [ ] Audio format explicitly set to `audio/pcmu`
- [ ] User can hear AI voice response within 2 seconds
- [ ] AI can transcribe Japanese speech correctly
- [ ] Interrupt handling works (AI stops when user speaks)
- [ ] No SIP-related code remains in codebase
- [ ] `USE_OPENAI_SIP` flag removed from configuration

## Rollback Strategy
The current Media Streams implementation already exists. If fixes cause issues, we can revert to commit before this change using git.

Legacy Coefont TTS mode remains available via `USE_OPENAI_REALTIME=false`.

---

## Implementation Progress

### ✅ Phase 8.14: 会話履歴リアルタイム表示機能実装 (2025-10-18)

**Status**: COMPLETED

**作業内容**:
- OpenAI Realtime APIからAI発話テキストを抽出
- Whisper-1モデルでユーザー音声の転写を有効化
- WebSocket経由でフロントエンドへリアルタイム配信
- CallStatusModalにAI（青色）とお客様（緑色）の発話を表示
- MongoDBへの会話履歴保存を確認

**技術実装**:
1. **`extractTextFromContent()`**: 複数のcontent typeからテキスト抽出
   - `output_audio`の`transcript`フィールド対応
   - `text`, `input_text`, `output_text`対応
2. **`sendConversationUpdate()`**: Socket.io経由で`transcript-update`イベント送信
3. **Session configuration**: `audio.input.transcription: { model: 'whisper-1' }`
4. **Event handler**: `conversation.item.input_audio_transcription.completed`

**エラーと修正**:
- **Error 1**: 初回実装で完全音声停止 → `git restore`でロールバック、段階的実装に変更
- **Error 2**: 転写設定の誤配置（トップレベル） → `audio.input.transcription`内に移動

**段階的実装アプローチ**:
- Step 1: ヘルパー関数のみ追加
- Step 2: AI発話抽出とWebSocket送信 → **成功** ✅
- Step 3: ユーザー転写設定 → **成功** ✅

**テスト結果**:
- ✅ AI発話が青色で「AIオペレーター」として表示
- ✅ ユーザー発話が緑色で「お客様」として表示
- ✅ リアルタイムWebSocket更新が動作
- ✅ MongoDBに会話履歴保存を確認
- ⚠️ **発見された新しい問題**: プロンプト変数未置換

**Modified Files**:
- `backend/controllers/mediaStreamController.js`:
  - Lines 25-48: `extractTextFromContent()` 関数
  - Lines 50-74: `sendConversationUpdate()` 関数
  - Lines 87-99: Session configuration with user transcription
  - Lines 268-296: User transcription event handler
  - Lines 309-314: AI response WebSocket emission
- `backend/check-conversation.js`: データベース確認スクリプト（デバッグ用）

**Key Learnings**:
- AI音声: `output_audio`型、テキストは`transcript`フィールド（`text`ではない）
- ユーザー音声: `input_audio`型、テキストは`transcript`フィールド
- 転写設定: `audio.input.transcription`内に配置（トップレベルではない）
- 段階的実装の重要性: 一度にすべて変更 → エラー箇所特定困難

**Detailed Documentation**: [SESSION_SUMMARY_2025-10-18_Phase8.14.md](./SESSION_SUMMARY_2025-10-18_Phase8.14.md)

---

### ⚠️ Phase 8.15: プロンプト変数置換の実装 (NEXT TASK)

**Problem**:
`backend/config/templates.js`のテンプレート変数（`{{selfIntroduction}}`, `{{serviceDescription}}`等）が置換されずにOpenAIに送信され、AIの応答が意味不明になる。

**Root Cause**:
```javascript
initial: 'お世話になります。{{selfIntroduction}}。弊社は{{serviceDescription}}会社でございます...'
```
このテンプレートがそのままOpenAIの`instructions`に設定されている。

**Required Actions**:
1. AgentSettingsをMongoDBから取得
2. テンプレート変数を実際の値で置換
3. 置換済みinstructionsをOpenAIに送信

**Data Source**: AgentSettingsモデル
- `companyName`, `serviceName`, `representativeName`等

---

### Task Status Update

**Completed Tasks**:
- [x] 8.1 Test server startup (✅ Phase 2)
- [x] 8.2 Make test call to Twilio number (✅ Phase 2)
- [x] 8.3 Verify WebSocket connections (✅ Phase 2)
- [x] 8.4 Verify session initialization (✅ Phase 2)
- [x] 8.5 Test audio bidirectionality (✅ Phase 2)
- [x] 8.6 Test Japanese speech recognition (✅ Phase 2)
- [x] 8.7 Test AI response generation (✅ Phase 2)
- [x] 8.12 GUI一斉コールでOpenAI Realtime API使用確認 (✅ Phase 3)
- [x] 8.13 Socket.io WebSocket接続エラー修正 (✅ Phase 3)
- [x] **8.14 会話履歴リアルタイム表示機能実装** (✅ Phase 8.14)

**New Tasks**:
- [ ] **8.15 プロンプト変数置換の実装** (NEXT TASK)

**Remaining Tasks (Phase 8)**:
- [ ] 8.8 Test interrupt handling (user interrupts AI mid-response)
- [ ] 8.9 Verify conversation logs saved to database ✅ (実質完了、Phase 8.14で確認済み)
- [ ] 8.10 Test concurrent calls (2-3 simultaneous)
- [ ] 8.11 Test legacy mode fallback (USE_OPENAI_REALTIME=false)

**Phase 9: Documentation & Cleanup** (Pending)
- [ ] 9.1 Update CLAUDE.md with correct architecture diagram
- [ ] 9.2 Document Media Streams approach (not SIP)
- [ ] 9.3 Add reference link to Twilio official sample
- [ ] 9.4 Document audio format requirements (audio/pcmu)
- [ ] 9.5 Add troubleshooting section for common issues
- [ ] 9.6 Remove any SIP-related documentation
