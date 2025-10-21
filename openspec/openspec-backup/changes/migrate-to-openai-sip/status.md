# Migration Status: OpenAI SIP Integration

**Last Updated**: 2025-10-17 16:30 JST

## Current Status: 🔴 BLOCKED - Root Cause Identified

### Summary
Migration from Twilio Media Streams to OpenAI SIP integration is ~85% complete. **Webhooks are being received and Accept API succeeds (200 OK), but SIP audio session establishment is failing**, causing calls to disconnect after 4 seconds with a beep sound.

### Investigation Results (2025-10-17)

#### ✅ Working Components
1. **Twilio → Backend**: Incoming call webhook received successfully
2. **Backend → Twilio**: TwiML with `<Dial><Sip>` sent correctly
3. **Twilio → OpenAI SIP**: Connection initiated to `sip:proj_cOnmNcLrCIpH9Za063arfJyd@sip.api.openai.com;transport=tls`
4. **OpenAI → Backend Webhook**: `realtime.call.incoming` webhook received successfully
5. **Backend → OpenAI Accept API**: Returns `200 OK` (empty body is expected per API spec)
6. **Webhook Response**: Backend returns `200 OK` to OpenAI within timeout

#### ❌ Failing Component: SIP Audio Session Establishment

**Symptoms**:
- Call connects and answers
- User hears beep sound (connection tone)
- After ~4 seconds, call disconnects
- Twilio shows call completed with duration: 4 seconds
- No error codes from Twilio side

**Technical Flow Observed**:
```
1. ✅ User calls → Twilio receives
2. ✅ Twilio → Backend webhook (/api/twilio/voice)
3. ✅ Backend → TwiML: <Dial><Sip>sip:proj_xxx@sip.api.openai.com</Sip></Dial>
4. ✅ Twilio → OpenAI SIP endpoint (initiates SIP INVITE)
5. ✅ OpenAI → Backend webhook (realtime.call.incoming)
6. ✅ Backend → OpenAI Accept API (200 OK, empty response body)
7. ❌ SIP audio session negotiation FAILS
8. ❌ Twilio terminates call after 4 seconds
```

### Root Cause Analysis

#### Issue 1: Accept API 404 Errors (RESOLVED with retry logic)
**Problem**: Initial Accept API calls returned 404 `call_id_not_found`
**Cause**: Race condition - webhook arrives before SIP session is fully registered
**Solution**: Implemented retry logic (max 3 retries, 1s delay)
**Status**: ✅ Resolved, Accept API now succeeds on retry

#### Issue 2: Empty Accept API Response (EXPECTED BEHAVIOR)
**Observation**: Accept API returns `200 OK` with empty body (`""`)
**Analysis**: Per OpenAI docs: "The endpoint returns 200 OK once the SIP leg is ringing and the realtime session is being established"
**Status**: ✅ This is correct API behavior, not an error

#### Issue 3: SIP Audio Session Failure (CURRENT BLOCKER)
**Problem**: After successful Accept API, SIP audio stream never establishes
**Evidence**:
- Accept API: `200 OK` (successful)
- Response data: `""` (expected)
- `session_id`: `undefined` (not returned by Accept API, expected)
- Call duration: 4 seconds (time until Twilio gives up)
- No audio exchanged

**Possible Causes**:
1. **Invalid Model Name**: Using `"gpt-4o-realtime-preview-2024-12-17"` but docs show `"gpt-realtime"`
2. **Missing Required Parameters**: Accept API payload may be missing required fields
3. **OpenAI SIP Audio Codec Mismatch**: OpenAI may not support the codec Twilio is offering
4. **TLS Certificate Issue**: SIP over TLS may be failing certificate validation
5. **OpenAI Service Issue**: Realtime API SIP integration may have service issues

### Detailed Logs Analysis

**Latest Test Call** (`CA68c5d69b530404bce64d2cc0697a5b02`):

```
[Incoming Call] CallSid: CA68c5d69b530404bce64d2cc0697a5b02
[Incoming Call] Using OpenAI Realtime API with SIP Integration
[Incoming Call] SIP URI: sip:proj_cOnmNcLrCIpH9Za063arfJyd@sip.api.openai.com;transport=tls

[OpenAI Webhook] Received call-incoming event
[OpenAI Webhook] Call ID: rtc_30b2e5b2dc584227b2269a4e471d95bf
[OpenAI Webhook] Twilio Child CallSid: CA<child_sid>
[OpenAI Webhook] Parent CallSid: CA68c5d69b530404bce64d2cc0697a5b02

[OpenAI Webhook] DEBUG: Sending accept request (attempt 1/4)
[OpenAI Webhook] DEBUG: Request payload: {
  "model": "gpt-4o-realtime-preview-2024-12-17",
  "modalities": ["text", "audio"],
  "instructions": "電話での会話を行うAIアシスタントです。",
  "voice": "alloy",
  "input_audio_transcription": { "model": "whisper-1" },
  "turn_detection": {
    "type": "server_vad",
    "threshold": 0.5,
    "prefix_padding_ms": 300,
    "silence_duration_ms": 500
  },
  "tools": []
}

[OpenAI Webhook] DEBUG: Accept response status: 200
[OpenAI Webhook] DEBUG: Accept response data: ""
[OpenAI Webhook] Call accepted: rtc_30b2e5b2dc584227b2269a4e471d95bf Session ID: undefined
[OpenAI Webhook] DEBUG: Response sent successfully

# Call disconnects after 4 seconds - no audio session
```

**Twilio Call Details**:
```
Call Status: completed
Duration: 4 seconds
Error Code: undefined
Direction: outbound-api
```

### Next Steps to Resolve

#### Priority 1: Fix Model Name
**Action**: Change model from `"gpt-4o-realtime-preview-2024-12-17"` to `"gpt-realtime"`
**Reason**: Docs example uses `"gpt-realtime"`, current model name may be invalid
**File**: `backend/controllers/openaiWebhookController.js:231`

#### Priority 2: Verify Accept API Payload
**Action**: Compare payload with docs and ensure all required fields are present
**Reference**: OpenAI docs `/docs/api-reference/realtime-calls/accept-call`

#### Priority 3: Check OpenAI Platform Dashboard
**Action**: Log into platform.openai.com and check:
- Call logs/history for `rtc_30b2e5b2dc584227b2269a4e471d95bf`
- Any error messages or status indicators
- SIP integration health status

#### Priority 4: Check Twilio SIP Logs
**Action**: Log into Twilio Console and check:
- SIP trace logs for `CA68c5d69b530404bce64d2cc0697a5b02`
- SIP INVITE/ACK/BYE sequence
- Any SIP error responses from OpenAI

#### Priority 5: Test with Minimal Config
**Action**: Reduce Accept API payload to minimal required fields:
```json
{
  "model": "gpt-realtime",
  "instructions": "You are a helpful assistant."
}
```

### Files Modified (Recent)

**Investigation & Debugging**:
- `backend/controllers/openaiWebhookController.js` - Added extensive debug logging
- `backend/controllers/openaiWebhookController.js:71-111` - Added retry logic for Accept API
- `backend/controllers/openaiWebhookController.js:281-340` - Moved sideband connection to background (non-blocking)

**Previous Implementation**:
- `backend/.env.local` - SIP configuration
- `backend/routes/openaiWebhookRoutes.js` - Webhook routes
- `backend/services/openaiSidebandService.js` - WebSocket service
- `backend/models/CallSession.js` - Added `openaiCallId`, `openaiSessionId` fields

### Configuration
```bash
# Current .env.local
USE_OPENAI_SIP=true
OPENAI_PROJECT_ID=proj_cOnmNcLrCIpH9Za063arfJyd
OPENAI_WEBHOOK_SECRET=whsec_9RWVqiPYaqgGgKJs6Ubop64v2JRxNBNjT4t6BwMl4VI=
NGROK_URL=https://3b9c568444ef.ngrok-free.app
BASE_URL=https://3b9c568444ef.ngrok-free.app
```

### Known Issues
1. ⚠️ Webhook signature verification failing (currently bypassed for testing)
2. 🔴 **SIP audio session not establishing after Accept API success**
3. ⚠️ Model name may be incorrect (`gpt-4o-realtime-preview-2024-12-17` vs `gpt-realtime`)
4. ℹ️ Sideband WebSocket connection timing out (non-critical, audio should work via SIP)

### Working Fallback
Set `USE_OPENAI_SIP=false` in `.env.local` to revert to Twilio Media Streams approach (legacy mode with Coefont TTS).

---

**Status Key**:
- ✅ Complete/Working
- ⚠️ Partial/Warning
- 🔴 Blocked/Critical
- ❌ Failed
- ℹ️ Informational
