# Migration Plan: Simple Version → Production Integration

**Status**: Planning Phase
**Target**: Integrate working WebSocket implementation into production system
**Created**: 2025-10-18

---

## Current State Analysis

### ✅ What's Working (Simple Version)

**Files**:
- `backend/server.js` - Native ws.Server implementation
- `backend/controllers/mediaStreamController.simple.js` - Simplified handler
- `backend/controllers/twilioVoiceController.ultraSimple.js` - Debug TwiML handler
- Route: `/api/twilio/incoming-call` → Ultra-simple (NO DATABASE)
- WebSocket: `/api/twilio/media-stream-simple` → Working perfectly

**Features**:
- ✅ WebSocket connection (Twilio → Backend → OpenAI)
- ✅ Session initialization with correct audio format
- ✅ Japanese speech recognition
- ✅ AI response generation
- ✅ Real-time bidirectional audio

**Limitations**:
- ❌ No database integration (no conversation logs)
- ❌ No CallSession management
- ❌ No AgentSettings configuration
- ❌ No customer lookup
- ❌ No error handling for production scenarios
- ❌ Hard-coded configuration values

---

### 🎯 Target State (Production Integration)

**Requirements** (from original spec):
1. Load CallSession from database by ID
2. Load AgentSettings for assigned agent
3. Apply agent-specific configuration (voice, instructions, tools)
4. Save conversation items to `realtimeConversation` array
5. Update CallSession status on connection/disconnection
6. Handle errors gracefully with proper logging
7. Support concurrent calls
8. Integrate with existing WebSocket notification service
9. Work with bulk call system
10. Support agent handoff functionality

**Files to Integrate**:
- `backend/controllers/mediaStreamController.js` - Production handler (needs WebSocket fix)
- `backend/controllers/twilioVoiceController.js` - Production TwiML (already working)
- Route: `/api/twilio/voice` → Production endpoint
- WebSocket: `/api/twilio/media-stream/:callId` → Needs native ws implementation

---

## Migration Strategy

### Phase 1: Migrate WebSocket Server to Production Handler ✅ **COMPLETED 2025-10-18**

**Goal**: Replace simple handler with production handler while keeping native ws library

**Status**: ✅ **完了** - 本番環境用WebSocketハンドラーが正常に動作中

**Completion Summary**:
- server.js updated with manual WebSocket upgrade handling
- Production endpoint `/api/twilio/media-stream/:callId` registered
- callId parameter extraction working correctly
- Both simple and production endpoints available
- Temperature parameter added to OpenAI connection
- OpenAI-Beta header removed (matching Python sample)

**Steps**:

#### 1.1 Update server.js WebSocket initialization
```javascript
// Current (Simple):
const wss = new WebSocket.Server({
  server,
  path: '/api/twilio/media-stream-simple'
});
wss.on('connection', (ws, req) => {
  simpleMediaStreamController.handleSimpleMediaStream(ws, req);
});

// Target (Production with parameter):
const wss = new WebSocket.Server({
  server,
  noServer: true  // Manual upgrade handling for path parameters
});

server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;

  if (pathname.startsWith('/api/twilio/media-stream/')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      const callId = pathname.split('/').pop();
      const req = { params: { callId }, url: request.url };
      mediaStreamController.handleMediaStream(ws, req);
    });
  } else {
    socket.destroy();
  }
});
```

#### 1.2 Update mediaStreamController.js for native ws library

**Changes needed**:
- Replace express-ws specific code with native ws
- Keep all database operations
- Keep all error handling
- Keep conversation logging

**Compatibility check**:
```javascript
// express-ws signature:
exports.handleMediaStream = async (twilioWs, req) => { ... }

// native ws signature (SAME!):
exports.handleMediaStream = async (twilioWs, req) => { ... }
// ✅ No changes needed to function signature
```

**Files to modify**:
- `backend/controllers/mediaStreamController.js` (minimal changes - already compatible)

---

### Phase 2: Test Production Handler Incrementally ✅ **COMPLETED 2025-10-18**

**Status**: ✅ **完了** - データベース統合と会話ログ保存が正常に動作

**Completion Summary**:
- CallSession loading from database working correctly
- Conversation logging to database implemented and tested
- 4 conversation turns successfully saved with Japanese transcripts
- CallSession schema updated to support Mixed type for content field
- All database operations functioning properly

### Phase 2 (Original Plan): Test Production Handler Incrementally

**Approach**: Add features back one at a time, testing after each addition

#### 2.1 Database Connection Only
- Load CallSession by ID
- Test: Verify CallSession is loaded, log its properties
- Success criteria: No errors, CallSession found

#### 2.2 Add AgentSettings Loading
- Load AgentSettings for assigned agent
- Apply voice, instructions, tools configuration
- Test: Verify agent-specific settings are applied
- Success criteria: Correct voice, instructions in session.update

#### 2.3 Add Conversation Logging
- Save conversation items to `realtimeConversation`
- Test: Make call, verify items are saved to database
- Success criteria: Database contains conversation history

#### 2.4 Add Status Updates
- Update CallSession status on connect/disconnect
- Test: Verify status changes (in-progress → completed)
- Success criteria: Database reflects correct status

#### 2.5 Add Error Handling
- Implement graceful error handling
- Test: Simulate errors (invalid CallSession, missing AgentSettings)
- Success criteria: Errors logged, call doesn't crash

---

### Phase 3: Switch to Production Route

**Goal**: Use production endpoint instead of debug endpoint

#### 3.1 Update Feature Flag Usage
```javascript
// backend/controllers/twilioVoiceController.js
// Current:
const useSimpleEndpoint = process.env.USE_SIMPLE_MEDIA_STREAM === 'true';
const streamUrl = useSimpleEndpoint
  ? `wss://${host}/api/twilio/media-stream-simple`
  : `wss://${host}/api/twilio/media-stream/${callSession._id}`;

// Target (remove flag after testing):
const streamUrl = `wss://${host}/api/twilio/media-stream/${callSession._id}`;
```

#### 3.2 Test Production Flow
- Use `/api/twilio/voice` endpoint (already working)
- WebSocket should connect to `/api/twilio/media-stream/:callId`
- Test: Full end-to-end call with database operations
- Success criteria: All features working

---

### Phase 4: Cleanup and Re-enable Security

#### 4.1 Re-enable helmet() with WebSocket exceptions
```javascript
// server.js
app.use(helmet({
  contentSecurityPolicy: false,  // For WebSocket
  crossOriginEmbedderPolicy: false  // For WebSocket
}));
```

#### 4.2 Remove Debug Files (Optional)
- Consider keeping for future debugging:
  - `mediaStreamController.simple.js`
  - `twilioVoiceController.ultraSimple.js`
- Or move to `/debug` folder

#### 4.3 Remove Feature Flags
- Remove `USE_SIMPLE_MEDIA_STREAM` from .env
- Remove conditional logic in twilioVoiceController.js

---

### Phase 5: Advanced Features & Testing

#### 5.1 Concurrent Calls
- Test 2-3 simultaneous calls
- Verify WebSocket connections don't interfere
- Check database transaction safety

#### 5.2 Interrupt Handling
- Test user interrupting AI mid-response
- Verify `conversation.item.truncate` works correctly
- Confirm Twilio buffer clearing

#### 5.3 Legacy Mode Compatibility
- Set `USE_OPENAI_REALTIME=false`
- Test Conference mode still works
- Verify fallback behavior

#### 5.4 Bulk Call Integration
- Test bulk call feature with Realtime API
- Verify multiple outbound calls work
- Check database logging for bulk calls

#### 5.5 Agent Handoff Integration
- Test agent joining ongoing call
- Verify OpenAI connection terminates gracefully
- Check Conference mode takeover

---

## Detailed Task Breakdown

### Task 1: Update server.js for Production WebSocket ⏳ NEXT

**File**: `backend/server.js`

**Changes**:
```javascript
// BEFORE (Simple version):
const wss = new WebSocket.Server({
  server,
  path: '/api/twilio/media-stream-simple'
});

const simpleMediaStreamController = require('./controllers/mediaStreamController.simple');

wss.on('connection', (ws, req) => {
  console.log('[WebSocket] New connection to:', req.url);
  simpleMediaStreamController.handleSimpleMediaStream(ws, req);
});

// AFTER (Production version with callId parameter):
const wss = new WebSocket.Server({ server, noServer: true });
const mediaStreamController = require('./controllers/mediaStreamController');

server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;

  if (pathname.startsWith('/api/twilio/media-stream/')) {
    console.log('[WebSocket] Upgrade request:', pathname);

    wss.handleUpgrade(request, socket, head, (ws) => {
      const callId = pathname.split('/').pop();
      console.log('[WebSocket] Connection for callId:', callId);

      // Create req object compatible with controller
      const req = {
        params: { callId },
        url: request.url,
        headers: request.headers
      };

      mediaStreamController.handleMediaStream(ws, req);
    });
  } else {
    console.log('[WebSocket] Rejected upgrade for:', pathname);
    socket.destroy();
  }
});
```

**Testing**:
1. Start server
2. Make call using production endpoint `/api/twilio/voice`
3. Verify WebSocket connects to `/api/twilio/media-stream/:callId`
4. Check logs show correct callId

**Success Criteria**:
- WebSocket connection established
- callId parameter extracted correctly
- Controller receives callId in req.params

---

### Task 2: Verify mediaStreamController.js Compatibility ⏳ NEXT

**File**: `backend/controllers/mediaStreamController.js`

**Check**: Function signature compatibility
```javascript
// Current signature (lines 79-80):
exports.handleMediaStream = async (twilioWs, req) => {
  const callId = req.params.callId;
  // ... rest of code
}
```

**Compatibility**: ✅ Already compatible with native ws!
- Signature is identical to simple version
- Only uses standard WebSocket API methods
- No express-ws specific code

**Potential Issues to Check**:
1. Line 114-119: WebSocket headers
   ```javascript
   openaiWs = new WebSocket(openaiUrl, {
     headers: {
       'Authorization': `Bearer ${process.env.OPENAI_REALTIME_API_KEY}`,
       'OpenAI-Beta': 'realtime=v1'  // ← REMOVE THIS (not in Python sample)
     }
   });
   ```

2. Line 228-234: WebSocket readyState check
   ```javascript
   if (data.event === 'media' && openaiWs && openaiWs.readyState === WebSocket.OPEN) {
   ```
   ✅ This is standard ws API, should work

**Changes Needed**:
- Remove `OpenAI-Beta` header (line 117)
- Add `temperature` parameter to URL (line 111)

**Testing**:
1. Update header and temperature
2. Make test call
3. Verify database operations work
4. Check conversation logging

---

### Task 3: Incremental Feature Testing

**Test 3.1: Database Connection**
```bash
# Make call with production endpoint
# Expected logs:
[MediaStream] CallSession loaded: <ObjectId>
[MediaStream] AgentSettings loaded for user: <userId>
```

**Test 3.2: AgentSettings Application**
```bash
# Check session.update includes agent settings:
[OpenAI] Sending session update: {
  "voice": "alloy",  # From AgentSettings
  "instructions": "...",  # From AgentSettings.conversationSettings
  "tools": [...]  # From AgentSettings.tools
}
```

**Test 3.3: Conversation Logging**
```bash
# After call, check MongoDB:
db.callsessions.findOne({ _id: ObjectId("...") }).realtimeConversation
# Should contain array of conversation items
```

**Test 3.4: Concurrent Calls**
```bash
# Make 2 calls simultaneously
# Check logs show distinct callIds
# Verify both calls work independently
```

---

## Risk Mitigation

### Risk 1: Database Operations Slow Down WebSocket

**Mitigation**:
- Database operations already wrapped in try-catch
- WebSocket connection established before DB queries
- Audio streaming independent of DB operations

**Contingency**:
- Move DB operations to background queue if needed
- Use non-blocking queries

### Risk 2: Production Controller Breaks WebSocket

**Mitigation**:
- Keep simple version as fallback
- Test incrementally (one feature at a time)
- Feature flag allows instant rollback

**Contingency**:
- Set `USE_SIMPLE_MEDIA_STREAM=true` to rollback
- Simple version stays in codebase

### Risk 3: Concurrent Calls Interfere

**Mitigation**:
- Each WebSocket connection is isolated
- callId ensures distinct sessions
- Test with 2-3 concurrent calls first

**Contingency**:
- Add connection pooling if needed
- Implement rate limiting

---

## Success Criteria (Production Integration Complete)

### Functional Requirements
- [x] WebSocket connections work with callId parameter ✅ **COMPLETED 2025-10-18**
- [x] CallSession loaded from database ✅ **COMPLETED 2025-10-18**
- [x] AgentSettings applied to session ✅ **COMPLETED 2025-10-18**
- [x] Conversation items saved to database ✅ **COMPLETED 2025-10-18**
- [x] CallSession status updates correctly ✅ **COMPLETED 2025-10-18**
- [ ] Error handling works (missing CallSession, etc.)
- [ ] Concurrent calls work (2-3 simultaneous)
- [ ] Interrupt handling functional
- [ ] Legacy Conference mode still works
- [ ] Bulk call integration works

### Technical Requirements
- [x] Native ws library used (no express-ws) ✅ **COMPLETED 2025-10-18**
- [ ] helmet() re-enabled with WebSocket exceptions
- [ ] No debug code in production path
- [ ] Feature flags removed (or documented)
- [x] Comprehensive error logging ✅ **COMPLETED 2025-10-18**
- [ ] Performance acceptable (<2s latency)

### Documentation Requirements
- [ ] Architecture diagram updated
- [ ] Migration steps documented
- [ ] Troubleshooting guide created
- [ ] Code comments updated
- [ ] CLAUDE.md updated with WebSocket details

---

## Timeline Estimate

| Phase | Tasks | Estimated Time | Risk Level |
|-------|-------|----------------|------------|
| Phase 1 | WebSocket migration | 1-2 hours | Low (proven pattern) |
| Phase 2 | Incremental testing | 2-3 hours | Medium (database integration) |
| Phase 3 | Production switchover | 1 hour | Low (straightforward) |
| Phase 4 | Cleanup & security | 1 hour | Low (configuration) |
| Phase 5 | Advanced testing | 2-3 hours | Medium (complex scenarios) |
| **Total** | | **7-10 hours** | |

---

## Rollback Plan

### If Production Integration Fails

**Immediate Rollback** (< 1 minute):
```bash
# Set in backend/.env
USE_SIMPLE_MEDIA_STREAM=true
# Restart server
npm start
```

**Fallback to Conference Mode** (< 1 minute):
```bash
# Set in backend/.env
USE_OPENAI_REALTIME=false
# Restart server
npm start
```

**Code Rollback** (if needed):
```bash
git diff backend/server.js
git checkout HEAD -- backend/server.js
npm start
```

---

## Next Session Checklist

**Before Starting**:
- [ ] Review this migration plan
- [ ] Confirm current system working (simple version)
- [ ] Backup current .env configuration
- [ ] Note current ngrok URL

**Session Goals** (Priority Order):
1. [ ] Task 1: Update server.js for production WebSocket
2. [ ] Task 2: Test production WebSocket connection
3. [ ] Task 3.1: Test database loading
4. [ ] Task 3.2: Test AgentSettings application
5. [ ] Task 3.3: Test conversation logging

**Success Definition**:
End of session, production handler works with database integration while maintaining all working features from simple version.

---

## Notes for Future Reference

### Why This Approach?

1. **Incremental**: Add features one at a time, test after each
2. **Reversible**: Can rollback at any point
3. **Low-risk**: Simple version remains available
4. **Proven**: Based on working implementation

### Key Insights from Simple Version

1. Native ws library is more reliable than express-ws
2. WebSocket upgrade must happen at http server level
3. Temperature parameter improves AI consistency
4. OpenAI-Beta header not needed (and may cause issues)
5. Python reference implementation is accurate and valuable

### Critical Success Factors

1. **Don't rush**: Test each feature individually
2. **Keep simple version**: Valuable debugging tool
3. **Monitor logs**: WebSocket issues show up in logs first
4. **Compare with Python**: When in doubt, check Python sample
5. **Document everything**: Future debugging will thank you

---

**Status**: Ready for migration. Simple version validated and working. Production path clear.
