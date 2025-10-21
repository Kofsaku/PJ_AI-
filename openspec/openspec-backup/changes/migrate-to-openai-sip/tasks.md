# Implementation Tasks

## Phase 1: Environment Setup
- [x] Add `OPENAI_PROJECT_ID` to `.env` files
- [x] Add `OPENAI_WEBHOOK_SECRET` to `.env` files
- [x] Add `USE_OPENAI_SIP` feature flag to `.env` files (default: false)
- [x] Configure OpenAI Platform webhook URL: `{BASE_URL}/api/openai/webhook/call-incoming`

## Phase 2: Webhook Infrastructure
- [x] Create `backend/routes/openaiWebhookRoutes.js`
  - Route for `POST /api/openai/webhook/call-incoming`
- [x] Create `backend/controllers/openaiWebhookController.js`
  - Implement webhook signature verification (HMAC-SHA256)
  - Parse `realtime.call.incoming` event payload
  - Extract `call_id` from webhook
- [x] Register routes in `backend/server.js`
- [ ] Test webhook reception with mock payload

## Phase 3: Call Accept/Reject Logic
- [x] Implement `acceptCall(callId, sessionConfig)` in openaiWebhookController
  - POST to `https://api.openai.com/v1/realtime/calls/{call_id}/accept`
  - Send session configuration (model, modalities, instructions, voice, tools)
  - Handle response and extract session details
- [x] Implement `rejectCall(callId)` for error cases
- [x] Link to existing CallSession model (find by twilioCallSid)
- [x] Store `openaiCallId` in CallSession document

## Phase 4: Sideband WebSocket Connection
- [x] Modify `openaiRealtimeService.js` to support sideband mode
  - Connect to `wss://api.openai.com/v1/realtime?call_id={call_id}`
  - Remove audio input/output handling (audio flows via SIP)
  - Keep tool calling and session control logic
- [x] Implement connection lifecycle management
  - Connect after call accept
  - Disconnect on call end
  - Handle reconnection on errors
- [ ] Test tool calling via sideband connection

## Phase 5: Twilio TwiML Changes
- [x] Modify `twilioVoiceController.js` voice webhook
  - Add feature flag check: `if (process.env.USE_OPENAI_SIP === 'true')`
  - Return SIP transfer TwiML instead of Stream TwiML:
    ```xml
    <Response>
      <Dial>
        <Sip>sip:{OPENAI_PROJECT_ID}@sip.api.openai.com;transport=tls</Sip>
      </Dial>
    </Response>
    ```
  - Keep old Media Streams logic for rollback (`USE_OPENAI_SIP=false`)

## Phase 6: Cleanup (Only if SIP works)
- [ ] Keep `mediaStreamController.js` for rollback initially
- [ ] Remove Media Streams routes only after 1 week of stable SIP operation
- [ ] Document feature flag in README

## Phase 7: Testing & Validation
- [ ] Test webhook signature verification
- [ ] Test call accept flow end-to-end
- [ ] Verify audio bidirectional (can hear AI, AI can hear user)
- [ ] Verify Japanese speech recognition accuracy
- [ ] Test tool calling via sideband (e.g., customer lookup)
- [ ] Verify call recording still works
- [ ] Verify transcript saving still works
- [ ] Test error scenarios (invalid call_id, network failures)
- [ ] Load test with multiple concurrent calls

## Success Metrics
- ✅ OpenAI webhook `realtime.call.incoming` received successfully
- ✅ Call Accept API returns 200 with session ID
- ✅ User can hear AI voice response within 2 seconds
- ✅ AI can transcribe Japanese speech correctly
- ✅ Tool calls execute successfully via sideband
- ✅ Call recordings are saved to database
- ✅ Transcripts are saved with correct timestamps
