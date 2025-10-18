# Status: fix-media-streams-integration

**Status**: IN_PROGRESS
**Created**: 2025-10-17
**Last Updated**: 2025-10-17

## Summary

Implementing OpenAI Realtime API integration with Twilio Media Streams based on the official Twilio Python sample. This replaces the incorrect SIP-based approach with the correct Media Streams WebSocket bridge architecture.

**⚠️ CRITICAL DISCOVERY (2025-10-17)**: Old API keys created before Realtime API general availability do NOT have access to Realtime models, even if the organization has Realtime API enabled. Solution: Create new API key after Realtime API is enabled for the organization.

## Progress

### ✅ Completed Phases

#### Phase 1: Dependencies & Environment Setup
- Installed `ws@8.18.3` and `express-ws@5.0.2`
- Added environment variables: `USE_OPENAI_REALTIME`, `OPENAI_REALTIME_API_KEY`
- Updated `.env.example` with documentation

#### Phase 2: Create Media Streams Controller
- Created `backend/controllers/mediaStreamController.js` (331 lines)
- Implemented WebSocket bridge between Twilio Media Streams and OpenAI Realtime API
- Configured audio format: `audio/pcmu` (μ-law)
- Configured server-side VAD (Voice Activity Detection)
- **Critical Fix**: Corrected event type to `response.output_audio.delta` (was incorrectly `response.audio.delta`)

#### Phase 3: Implement Interrupt Handling
- Implemented state tracking for active responses
- Handles `input_audio_buffer.speech_started` event
- Sends truncate commands to OpenAI
- Clears Twilio audio queue with `clear` event

#### Phase 4: Create Routes and Server Configuration
- Created `backend/routes/mediaStreamRoutes.js`
- **Important**: Modified to function-based registration for `express-ws` compatibility
- Initialized `express-ws` in `server.js` (lines 52-55)
- Registered WebSocket route directly on app instance

#### Phase 5: Update TwiML Response
- Modified `backend/controllers/twilioVoiceController.js` (lines 188-236)
- Added feature flag check: `USE_OPENAI_REALTIME === 'true'`
- Generates Media Streams TwiML: `<Connect><Stream url="wss://..."/></Connect>`
- Preserves legacy Conference mode as fallback
- **Enhancement**: Added WebSocket notifications and timeout management for OpenAI mode

#### Phase 6: Extend Data Models
- Added `voice` field to `AgentSettings` model (enum: alloy, echo, shimmer)
- Added `tools` array to `AgentSettings` model (OpenAI function definitions)
- Already completed in Phase 2: `realtimeSessionId` and `realtimeConversation` in `CallSession` model

#### Phase 7: Database Integration
- Load CallSession and AgentSettings in mediaStreamController
- Save conversation items to `realtimeConversation` array
- Update CallSession status on connection/disconnection
- Comprehensive error handling with proper logging

#### Phase 8.1: Server Startup Test
- ✅ Server starts successfully on port 5001
- ✅ WebSocket support initialized (express-ws)
- ✅ WebSocket route registered: `/api/twilio/media-stream/:callId`
- ✅ MongoDB connected

#### Phase 8.2: Official Python Sample Testing (2025-10-17)
- ✅ Cloned official Twilio Python sample
- ✅ Installed Python dependencies (fastapi, uvicorn, websockets, python-dotenv, twilio)
- ✅ Configured with Japanese system message
- ✅ **CRITICAL**: Discovered API key compatibility issue
  - Old API key (`sk-proj-XNXI...`, created 2025-03-19): ❌ `model_not_found` error
  - New API key (`sk-proj-o_O_...`, created 2025-10-17): ✅ Success
- ✅ Verified working models: `gpt-realtime`, `gpt-4o-realtime-preview`, `gpt-realtime-2025-08-28`
- ✅ Successful test call with Japanese AI response: "こんにちは！お話できてうれしいです。今日はどんなことをお手伝いしましょうか？"
- ✅ Confirmed: speech detection, session creation, Japanese TTS all working
- ✅ Token usage verified: ~284 tokens per interaction (127 input + 157 output)

#### Phase 8.3: Project Model Restrictions Discovery (2025-10-17)
- ✅ Discovered OpenAI Platform project-level "Allowed models" setting
- Initially appeared to be restriction list, but was actually empty by default
- **Root cause**: API keys created before Realtime API availability lack permissions
- **Solution**: Create new API keys after Realtime API is enabled for organization
- Updated `backend/.env` with new API key: `sk-proj-o_O_M1jg...`

### ✅ Completed Phases

#### Phase 8.4: Node.js Backend Testing - BREAKTHROUGH (2025-10-18)

**🎉 MAJOR BREAKTHROUGH: WebSocket Connection Established Successfully**

**Root Cause Identified**: `express-ws` library was **NOT processing WebSocket upgrade requests**
- TwiML generation: ✅ Working
- ngrok receiving WebSocket requests: ✅ Working
- Backend receiving WebSocket requests: ❌ **FAILING**
- Issue: `express-ws@5.0.2` failed to handle WebSocket upgrade (status_code: 0 in ngrok logs)

**Solution**: Replaced `express-ws` with **native `ws` library + http.createServer()**
```javascript
// Before (FAILED):
const expressWs = require('express-ws');
const wsInstance = expressWs(app);
app.ws('/api/twilio/media-stream-simple', handler);

// After (SUCCESS):
const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server, path: '/api/twilio/media-stream-simple' });
wss.on('connection', (ws, req) => handler(ws, req));
```

**Testing Results** (2025-10-18):
- ✅ Local WebSocket connection test: **SUCCESS**
- ✅ TwiML generation: **SUCCESS** (200 OK)
- ✅ Twilio → Backend WebSocket connection: **SUCCESS**
- ✅ Backend → OpenAI Realtime API connection: **SUCCESS**
- ✅ OpenAI session initialization: **SUCCESS**
- ✅ Japanese system message configuration: **SUCCESS**
- ✅ Audio bidirectionality: **SUCCESS** (user speaks, AI responds)
- ✅ Speech recognition: **SUCCESS** (input_audio_buffer events)
- ✅ AI response generation: **SUCCESS** (response.done events)
- ✅ Token usage tracking: **SUCCESS** (366 tokens per interaction)

**Logs Confirming Success**:
```
[Simple] Client connected
[Simple] Connecting to: wss://api.openai.com/v1/realtime?model=gpt-realtime&temperature=0.8
[Simple] Stream started: MZ80b5d7f4a448abf30bff6ac2a4281f63
[Simple] Connected to OpenAI Realtime API
[Simple] OpenAI event: session.created
[Simple] OpenAI event: session.updated
[Simple] OpenAI event: input_audio_buffer.speech_started
[Simple] OpenAI event: input_audio_buffer.committed
[Simple] OpenAI event: response.done
```

#### Phase 8: Testing & Validation
- [x] 8.2 Make test call to Twilio number ✅
- [x] 8.3 Verify WebSocket connections ✅
- [x] 8.4 Verify session initialization ✅
- [x] 8.5 Test audio bidirectionality ✅
- [x] 8.6 Test Japanese speech recognition ✅
- [x] 8.7 Test AI response generation ✅
- [ ] 8.8 Test interrupt handling (in progress)
- [ ] 8.9 Verify conversation logs saved to database
- [ ] 8.10 Test concurrent calls (2-3 simultaneous)
- [ ] 8.11 Test legacy mode fallback

### 🚧 In Progress

#### Phase 8.8-8.11: Remaining Tests
- Need to test interrupt handling (user interrupting AI mid-response)
- Need to verify database conversation logs are being saved
- Need to test concurrent call handling
- Need to verify legacy Conference mode still works

### ⏳ Pending

#### Phase 9: Documentation & Cleanup
- Update `CLAUDE.md` with correct architecture diagram
- Document Media Streams approach (not SIP)
- Add reference link to Twilio official sample
- Document audio format requirements
- Add troubleshooting section
- Remove SIP-related documentation

## Key Technical Decisions

1. **Model Name**: `gpt-realtime` (confirmed from official sample, not `gpt-4o-realtime-preview`)
2. **Audio Format**: `audio/pcmu` (μ-law codec, Twilio's default)
3. **Architecture**: Media Streams WebSocket bridge (not SIP integration)
4. **Event Type**: `response.output_audio.delta` (critical correction)
5. **VAD**: Server-side Voice Activity Detection (`server_vad`)
6. **WebSocket Library**: ~~`express-ws`~~ → **Native `ws` library** (express-ws failed to handle upgrades)
7. **Temperature**: `0.8` (matching Python sample for consistent AI behavior)

## Critical Fixes Applied

1. **Event Type Correction**: Changed from `response.audio.delta` to `response.output_audio.delta` to match OpenAI API
2. ~~**WebSocket Route Registration**: Modified `mediaStreamRoutes.js` to function-based pattern for `express-ws` compatibility~~ **SUPERSEDED**
3. **Database Schema**: Added missing fields to CallSession model
4. **Feature Parity**: Added WebSocket notifications and timeout management to OpenAI mode
5. **API Key Compatibility (2025-10-17)**: Replaced old API key with new one to gain Realtime API access
6. **🚨 WebSocket Library Replacement (2025-10-18)**: Replaced `express-ws` with native `ws` library
   - **Problem**: express-ws failed to process WebSocket upgrade requests (status_code: 0)
   - **Solution**: Used `WebSocket.Server({ server, path })` with http.createServer()
   - **Result**: WebSocket connections now work identically to Python sample
   - **Files Modified**:
     - `backend/server.js` - Removed express-ws, added native ws.Server
     - `backend/controllers/mediaStreamController.simple.js` - Simplified handler for ws library
7. **OpenAI-Beta Header Removal**: Removed `OpenAI-Beta: realtime=v1` header (not in Python sample)
8. **Temperature Parameter**: Added `temperature=0.8` to WebSocket URL (matching Python sample)

## Lessons Learned

### express-ws WebSocket Upgrade Failure (2025-10-18)

**Problem**:
- express-ws@5.0.2 completely failed to handle WebSocket upgrade requests from Twilio
- TwiML was generated correctly (200 OK)
- ngrok received WebSocket upgrade requests (confirmed via ngrok inspector)
- Backend showed NO logs of WebSocket connections
- ngrok showed `status_code: 0` (no response) for WebSocket requests
- Even local WebSocket connections failed with "socket hang up"

**Debugging Journey**:
1. Initially suspected database operations blocking TwiML generation → **Not the issue**
2. Suspected ngrok WebSocket forwarding → **ngrok was working correctly**
3. Suspected helmet() middleware blocking WebSocket → **Not the issue**
4. Suspected CORS configuration → **Not the issue**
5. **ACTUAL CAUSE**: express-ws simply wasn't processing WebSocket upgrades at all

**Root Cause**:
express-ws library incompatibility or misconfiguration causing it to silently fail on WebSocket upgrade requests. The library registered routes but never actually handled connections.

**Solution**:
Replace express-ws with native `ws` library using http.createServer() pattern (same as Python sample):

```javascript
// Create http server from Express app
const server = require('http').createServer(app);

// Create WebSocket server attached to http server
const wss = new WebSocket.Server({
  server,
  path: '/api/twilio/media-stream-simple'
});

// Handle connections directly
wss.on('connection', (ws, req) => {
  console.log('[WebSocket] New connection');
  handler(ws, req);
});
```

**Why This Works**:
- Native `ws` library has no dependencies on Express middleware chain
- WebSocket upgrade happens at http server level, before Express routing
- Matches Python FastAPI pattern (WebSocket at server level, not application level)
- More reliable and battle-tested for production WebSocket workloads

**Impact**:
- Immediate fix: WebSocket connections established successfully
- Performance: No overhead from Express middleware for WebSocket traffic
- Debugging: Clear, predictable connection handling
- Compatibility: Works identically to Python reference implementation

**Prevention**:
- When implementing WebSocket with Express, prefer native `ws` over express-ws
- Test WebSocket connections early in development (don't wait until full integration)
- Use ngrok inspector to verify WebSocket upgrade requests are being handled
- Compare with working reference implementations (Python sample was invaluable)

### API Key Permissions Issue (2025-10-17)

**Problem**:
- Old API key (created 2025-03-19) consistently returned `model_not_found` error
- Error persisted despite:
  - Organization having Realtime API access (Usage tier 1)
  - Project showing Realtime models in limits page
  - "Allowed models" list being empty (no restrictions)
  - Testing multiple model names (`gpt-realtime`, `gpt-4o-realtime-preview`, etc.)

**Root Cause**:
API keys created before Realtime API became available for the organization do NOT automatically gain access to new models, even after the organization is granted access. The permissions are fixed at key creation time.

**Solution**:
1. Create a new API key AFTER Realtime API is enabled for the organization
2. New key automatically includes Realtime API access
3. No special configuration or "Allowed models" settings needed

**Impact**:
- 6+ hours spent debugging what appeared to be code issues
- Multiple incorrect hypotheses (model names, project settings, headers)
- Official Python sample confirmed architecture was correct all along
- Issue was entirely API key permissions, not code implementation

**Prevention**:
- When new OpenAI features are released, existing API keys may need regeneration
- Test with `/v1/models` endpoint is insufficient (doesn't list Realtime models)
- Direct WebSocket test is more reliable for validating Realtime API access

## Testing Requirements

Before marking as READY_FOR_REVIEW:
- [ ] End-to-end call test successful
- [ ] Audio flows bidirectionally without latency
- [ ] Japanese speech recognition works
- [ ] Interrupt handling responds immediately
- [ ] Conversation logs persist correctly
- [ ] No crashes or memory leaks during extended calls
- [ ] Legacy mode still functional

## Reference

- Official Twilio Sample: https://github.com/twilio-samples/speech-assistant-openai-realtime-api-python
- Cloned locally to: `reference/twilio-openai-sample/`

## Next Steps

### Immediate (Next Session)
1. **Debug Node.js implementation issue**
   - Compare Node.js WebSocket implementation with Python sample
   - Verify event handling matches official sample
   - Fix application error encountered during bulk call test
   - Ensure proper error handling and logging

2. **Complete Node.js end-to-end testing**
   - Test single call through Node.js backend
   - Verify conversation logs persist to MongoDB
   - Test interrupt handling
   - Test bulk call functionality

3. **Performance & Reliability Testing**
   - Test concurrent calls (2-3 simultaneous)
   - Monitor memory usage during extended calls
   - Verify no WebSocket connection leaks
   - Test error recovery scenarios

### Future (After Core Functionality)
4. Complete documentation updates (Phase 9)
5. Mark change as READY_FOR_REVIEW

## Session End Notes (2025-10-17)

### Completed Today
- ✅ Discovered and resolved critical API key compatibility issue
- ✅ Successfully tested official Python sample with Realtime API
- ✅ Verified Japanese TTS and speech recognition working
- ✅ Updated backend `.env` with new API key
- ✅ Confirmed Realtime API access and models available

### Blocked/Pending
- ⏳ Node.js backend implementation showing application error
- ⏳ Need to compare Node.js vs Python WebSocket handling
- ⏳ Bulk call feature testing incomplete

### Files Modified Today
- `backend/.env` - Updated OpenAI API key
- `openspec/changes/fix-media-streams-integration/status.md` - Added lessons learned
