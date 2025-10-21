# Technical Design: OpenAI Realtime API Integration

## Context

### Background
The current AI call system uses a fragmented architecture:
1. **Twilio** handles telephony and low-quality speech recognition
2. **ConversationEngine** uses rule-based keyword matching for responses
3. **Coefont** generates Japanese TTS with 500-2000ms latency

This results in poor user experience (slow responses, misrecognitions, unnatural conversations).

### Constraints
- Must maintain compatibility with existing Twilio infrastructure
- Cannot disrupt active calls during migration
- Must support Japanese language with high accuracy
- Budget constraints: Optimize for cost-efficiency while improving quality

### Stakeholders
- **End Users**: Customers receiving AI calls (expect natural, fast responses)
- **Agents/Operators**: Monitor calls and intervene when needed
- **Developers**: Maintain and extend the conversation system
- **Business**: Reduce costs while increasing call success rate

## Goals / Non-Goals

### Goals
- Replace fragmented speech pipeline with unified OpenAI Realtime API (GA version)
- Achieve <500ms average response latency (vs current 1-3s)
- Improve Japanese speech recognition accuracy to 95%+ (vs current ~75%)
- Enable natural, context-aware conversations with GPT-4o
- Maintain existing features: operator handoff, call recording, real-time monitoring
- **Provide GUI controls** in Sales Pitch settings for configuring Realtime API
- **Ensure smooth migration** from legacy ConversationEngine with feature flags

### Non-Goals
- Building a custom LLM or speech model (use OpenAI's proven stack)
- Supporting languages other than Japanese in this phase
- Real-time voice cloning or custom voice training
- Replacing Twilio telephony infrastructure
- Forcing migration (legacy engine remains available for rollback)

## Decisions

### Decision 1: Use OpenAI Realtime API (All-in-One)
**Why**: OpenAI Realtime API provides WebSocket-based integration of Whisper (STT), GPT-4o (conversation), and TTS in a single service, eliminating latency from service-to-service communication.

**Alternatives Considered**:
1. **Keep separate services** (Twilio STT + OpenAI Chat + Coefont TTS)
   - ❌ High latency (>1s per turn)
   - ❌ Complex state synchronization
   - ❌ Poor Japanese recognition (Twilio)
2. **Custom speech pipeline** (Whisper API + GPT-4 API + Coefont)
   - ❌ Still requires sequential processing
   - ❌ Complexity in audio buffering and streaming
3. **OpenAI Realtime API** ✅
   - ✅ Single WebSocket connection
   - ✅ Native audio streaming
   - ✅ Built-in context management
   - ✅ Function calling support

**Trade-offs**:
- **Vendor Lock-in**: Tight coupling to OpenAI
  - Mitigation: Abstract behind `openaiRealtimeService.js` interface for potential future swaps
- **Cost**: Realtime API pricing may be higher than separate services
  - Mitigation: Monitor usage, implement session timeout, optimize prompt length

### Decision 2: Twilio Media Streams for Audio Transport
**Why**: Twilio Media Streams provides raw audio WebSocket streaming, allowing direct integration with OpenAI without intermediate buffering.

**Alternatives Considered**:
1. **Continue using Twilio Voice Recognition**
   - ❌ Poor Japanese accuracy
   - ❌ Cannot stream to OpenAI Realtime API
2. **Record and batch process**
   - ❌ High latency (seconds delay)
   - ❌ Loses real-time interaction
3. **Twilio Media Streams** ✅
   - ✅ Real-time bidirectional audio streaming
   - ✅ Low latency (<100ms network delay)
   - ✅ Compatible with OpenAI audio formats

**Architecture**:
```
Customer (Twilio Call)
    ↓ (WebSocket)
Backend WebSocket Endpoint (/api/twilio/media-stream)
    ↓ (Proxy)
OpenAI Realtime API (wss://api.openai.com/v1/realtime)
    ↓ (Audio + Text responses)
Backend (Forward to Twilio)
    ↓
Customer
```

### Decision 3: Deprecate ConversationEngine Templates
**Why**: GPT-4o's natural language understanding eliminates the need for hardcoded templates and keyword matching.

**Migration Plan**:
1. Convert existing templates to system prompts
   ```javascript
   // Old: templates.js
   { keyword: "予約", response: "ご予約の件ですね..." }

   // New: GPT-4o system prompt
   "You are a friendly appointment booking assistant. When customers mention
   reservations (予約), help them schedule by asking for date, time, and name."
   ```
2. Keep templates.js for 2-week rollback period
3. Archive templates after successful migration

### Decision 4: Session Management Strategy
**Why**: OpenAI Realtime API uses persistent WebSocket sessions. We need to ensure proper lifecycle management to avoid resource leaks.

**Design**:
- **Session Creation**: On Twilio call start, create OpenAI session with agent-specific config
- **Session Persistence**: Maintain session ID in `CallSession` model
- **Session Cleanup**: Close OpenAI session on Twilio call end or timeout (5-minute max idle)
- **Error Recovery**: Auto-reconnect on WebSocket disconnect (max 3 retries)

**Implementation**:
```javascript
// services/openaiRealtimeService.js
class RealtimeSession {
  async create(agentSettings) {
    this.ws = new WebSocket('wss://api.openai.com/v1/realtime');
    await this.configure(agentSettings.instructions, agentSettings.voice);
  }

  sendAudio(base64Audio) { /* stream to OpenAI */ }
  onResponse(callback) { /* handle AI responses */ }
  close() { /* cleanup */ }
}
```

### Decision 5: Function Calling for Dynamic Actions
**Why**: OpenAI Realtime API supports function calling, enabling GPT-4o to trigger backend actions (e.g., operator handoff, database queries) during conversation.

**Functions to Implement**:
1. `request_operator_handoff(reason: string)`
   - Trigger: GPT-4o detects customer frustration or complex request
   - Action: Initiate Twilio conference, notify operator dashboard
2. `get_customer_info(phone_number: string)`
   - Trigger: GPT-4o needs customer details
   - Action: Query MongoDB, return customer name/history
3. `schedule_appointment(date: string, time: string, name: string)`
   - Trigger: GPT-4o completes booking flow
   - Action: Save to database, send confirmation

**Schema Example**:
```json
{
  "name": "request_operator_handoff",
  "description": "Request human operator assistance when customer needs cannot be handled by AI",
  "parameters": {
    "type": "object",
    "properties": {
      "reason": { "type": "string", "description": "Why handoff is needed" }
    },
    "required": ["reason"]
  }
}
```

### Decision 6: GUI Configuration in Sales Pitch Settings Page
**Why**: Users need an intuitive interface to configure Realtime API without editing code or environment variables.

**Design Rationale**:
- Existing `/settings/sales-pitch` page already manages conversation settings
- Extend with "Realtime API設定" section (collapsible card)
- Provide toggle to enable/disable Realtime API per agent
- Auto-convert legacy `conversationSettings` to system prompt

**UI Components**:
1. **Toggle Switch**: "Realtime APIを有効化" (default: OFF for safe migration)
2. **Voice Dropdown**: alloy, echo, fable, onyx, nova, shimmer (with audio previews)
3. **Speed Slider**: 0.5x - 2.0x (visual feedback)
4. **Temperature Slider**: 0.0 - 1.0 (with explanation tooltip)
5. **Model Selector**: gpt-4o-realtime, gpt-4o-mini-realtime
6. **System Prompt Textarea**: Large multiline editor with template variables support
7. **Conversion Button**: "既存設定から生成" - auto-generate prompt from legacy settings

**Backward Compatibility**:
- Legacy `conversationSettings` fields remain visible
- Conversion helper shows before/after preview
- Toggle switch clearly indicates which engine is active

### Decision 7: Use GA API (Not Beta)
**Why**: OpenAI Realtime API has moved from beta to General Availability (GA) with breaking changes.

**Key GA Differences**:
1. **No beta header required** (remove `OpenAI-Beta: realtime=v1`)
2. **New session format**: Must specify `session.type = "realtime"`
3. **Event name changes**:
   - `response.audio.delta` → `response.output_audio.delta`
   - `response.text.delta` → `response.output_text.delta`
   - `response.audio_transcript.delta` → `response.output_audio_transcript.delta`
4. **New conversation item events**:
   - `conversation.item.created` → `conversation.item.added` + `conversation.item.done`
5. **Audio config moved**: `modalities` → `session.audio.output.voice`
6. **Client secret endpoint**: Use `/v1/realtime/client_secrets` (not separate beta endpoints)
7. **WebRTC SDP URL**: `/v1/realtime/calls` (new in GA)

**Migration Impact**:
- Use latest `openai` SDK with GA support
- Update all event listeners to new names
- Test thoroughly as beta code will not work with GA endpoints

## Risks / Trade-offs

### Risk 1: OpenAI Service Downtime
**Impact**: All AI calls fail during outages
**Likelihood**: Low (OpenAI has >99.9% uptime)
**Mitigation**:
- Implement fallback to operator handoff on API errors
- Display clear error messages to customers
- Monitor OpenAI status page and set up alerts

### Risk 2: Cost Overruns
**Impact**: Higher operational costs if Realtime API pricing exceeds budget
**Likelihood**: Medium (pricing model is usage-based)
**Mitigation**:
- Set up usage alerts in OpenAI dashboard
- Implement per-company rate limiting
- Optimize prompt length and session duration
- Fallback to cheaper GPT-4o-mini for low-priority calls

### Risk 3: Latency Regression
**Impact**: If latency exceeds 500ms, user experience degrades
**Likelihood**: Low (OpenAI typically <300ms)
**Mitigation**:
- Benchmark during testing phase
- Use CloudFront/CDN for audio asset delivery
- Optimize WebSocket connection pooling
- Monitor P95/P99 latency metrics

### Risk 4: Migration Bugs
**Impact**: Existing calls break during rollout
**Likelihood**: Medium (complex system changes)
**Mitigation**:
- Feature flag: `ENABLE_REALTIME_API=true` (default: false)
- Gradual rollout: 1% → 10% → 50% → 100%
- Keep old ConversationEngine code for instant rollback
- Comprehensive testing (see tasks.md section 8)

## Migration Plan

### Phase 1: Development & Testing (Days 1-4)
1. Implement `openaiRealtimeService.js` and test with mock calls
2. Set up Twilio Media Streams on dev phone number
3. Test bidirectional audio streaming with ngrok
4. Verify function calling (handoff, customer lookup)

### Phase 2: Internal Beta (Days 5-6)
1. Deploy to staging environment
2. Enable feature flag for admin users only
3. Run 50 test calls with various scenarios
4. Measure latency, accuracy, and cost

### Phase 3: Limited Rollout (Days 7-8)
1. Enable for 10% of production traffic
2. Monitor error rates, latency, and user feedback
3. Iterate on system prompts based on call quality

### Phase 4: Full Rollout (Days 9-10)
1. Enable for 100% of traffic
2. Monitor for 48 hours
3. Archive old ConversationEngine code after stability confirmed

### Rollback Procedure
If critical issues arise:
1. Set `ENABLE_REALTIME_API=false` in `.env`
2. Restart backend server (auto-reverts to old ConversationEngine)
3. No database rollback needed (schema changes are additive)
4. Expected downtime: <5 minutes

## Open Questions

### Q1: What is the exact pricing model for OpenAI Realtime API?
**Status**: Pending - need to confirm with OpenAI sales team
**Action**: Request pricing details and estimate monthly cost based on call volume

### Q2: Does OpenAI Realtime API support custom wake words or VAD tuning?
**Status**: Unknown - may impact conversation naturalness
**Action**: Review OpenAI documentation and test VAD sensitivity settings

### Q3: How do we handle multi-language support in the future?
**Status**: Out of scope for this change, but relevant for roadmap
**Action**: Document design considerations for future language expansion

### Q4: Can we cache frequently used TTS audio to reduce costs?
**Status**: Unclear - Realtime API may not expose raw audio
**Action**: Investigate if OpenAI allows audio caching or if we need to record responses

## Success Metrics

### Performance
- **Latency**: Average response time <500ms (P95 <800ms)
- **Accuracy**: Japanese transcription accuracy >95% (manual QA on 100 calls)
- **Uptime**: 99.5% success rate for call initialization

### Business
- **Call Completion Rate**: Increase from 60% to 80%+ (customers stay on call longer)
- **Operator Handoff Rate**: Decrease from 30% to <15% (AI handles more scenarios)
- **Cost per Call**: Maintain or reduce current cost (~$0.50/call target)

### Quality
- **User Satisfaction**: Gather feedback from 50 test calls (target: 4/5 stars)
- **Natural Conversation**: Zero robotic or repetitive responses (QA review)
