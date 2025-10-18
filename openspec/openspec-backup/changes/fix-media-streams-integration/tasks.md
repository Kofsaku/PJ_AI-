# Implementation Tasks

## Phase 1: Cleanup SIP Implementation
- [ ] 1.1 Remove `backend/routes/openaiWebhookRoutes.js`
- [ ] 1.2 Remove `backend/controllers/openaiWebhookController.js`
- [ ] 1.3 Remove `backend/services/openaiSidebandService.js`
- [ ] 1.4 Remove SIP-related routes from `backend/server.js`
- [ ] 1.5 Remove `USE_OPENAI_SIP`, `OPENAI_PROJECT_ID`, `OPENAI_WEBHOOK_SECRET` from `.env.local`
- [ ] 1.6 Remove `openaiCallId`, `openaiSessionId` fields from `CallSession` model (if added)

## Phase 2: Fix OpenAI Session Initialization
- [ ] 2.1 Update `openaiRealtimeService.js` to use `session.update` message format
- [ ] 2.2 Add audio format configuration: `audio.input.format = { type: "audio/pcmu" }`
- [ ] 2.3 Add audio format configuration: `audio.output.format = { type: "audio/pcmu" }`
- [ ] 2.4 Add turn detection: `audio.input.turn_detection = { type: "server_vad" }`
- [ ] 2.5 Add output modalities: `output_modalities = ["audio"]`
- [ ] 2.6 Remove any Accept API calls or SIP-related WebSocket connections

## Phase 3: Fix Media Stream Controller
- [ ] 3.1 Review `mediaStreamController.js` audio forwarding logic
- [ ] 3.2 Ensure `input_audio_buffer.append` uses Twilio's base64 payload directly
- [ ] 3.3 Ensure `response.output_audio.delta` is sent to Twilio without re-encoding
- [ ] 3.4 Add logging for audio event flow debugging

## Phase 4: Implement Interrupt Handling
- [ ] 4.1 Listen for `input_audio_buffer.speech_started` event
- [ ] 4.2 On speech start, send `clear` event to Twilio Media Streams
- [ ] 4.3 On speech start, send `conversation.item.truncate` to OpenAI
- [ ] 4.4 Track `last_assistant_item` and `response_start_timestamp`
- [ ] 4.5 Calculate `audio_end_ms` for truncation
- [ ] 4.6 Clear mark queue and reset tracking variables

## Phase 5: Session Configuration
- [ ] 5.1 Load agent settings from database
- [ ] 5.2 Include system prompt in `instructions` field
- [ ] 5.3 Include voice setting in `audio.output.voice`
- [ ] 5.4 Include tools array in session config (if configured)
- [ ] 5.5 Set model to `gpt-realtime` or URL parameter

## Phase 6: Testing & Validation
- [ ] 6.1 Test basic call flow (can make call, hear greeting)
- [ ] 6.2 Verify OpenAI session initializes (check logs for `session.created`)
- [ ] 6.3 Test bidirectional audio (user can hear AI, AI can hear user)
- [ ] 6.4 Verify Japanese speech recognition accuracy
- [ ] 6.5 Test interrupt handling (AI stops when user speaks)
- [ ] 6.6 Test tool calling via WebSocket (if tools configured)
- [ ] 6.7 Verify call recording still works
- [ ] 6.8 Verify transcript saving still works
- [ ] 6.9 Test with multiple concurrent calls
- [ ] 6.10 Load test (10+ concurrent calls)

## Phase 7: Documentation & Cleanup
- [ ] 7.1 Update CLAUDE.md with correct architecture
- [ ] 7.2 Remove SIP-related documentation
- [ ] 7.3 Add reference to official Twilio sample
- [ ] 7.4 Document audio format requirements (audio/pcmu)
- [ ] 7.5 Update troubleshooting guide

## Success Metrics
- ✅ OpenAI session initializes with correct audio format
- ✅ User hears AI response within 2 seconds
- ✅ AI correctly transcribes Japanese speech
- ✅ Interrupt handling works smoothly
- ✅ No SIP-related code in codebase
- ✅ Call recordings saved correctly
- ✅ Transcripts saved with timestamps
