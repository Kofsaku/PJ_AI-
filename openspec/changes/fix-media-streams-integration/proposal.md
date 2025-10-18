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
