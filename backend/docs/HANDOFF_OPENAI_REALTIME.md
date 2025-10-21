# Handoff Implementation for OpenAI Realtime API

## Overview

This document describes how the handoff (call transfer) feature works with OpenAI Realtime API (Media Streams mode).

## Architecture

### Old System (Conference Mode)
- AI and customer are in a Twilio Conference room from the start
- Handoff adds the human agent to the same Conference room
- 3-way call is naturally established

### New System (OpenAI Realtime API + Media Streams)
- Twilio and OpenAI communicate via WebSocket (Media Streams)
- No Conference room is initially used
- Handoff requires transitioning from Media Streams to Conference mode

## Handoff Flow

### 1. Media Streams Disconnection
When handoff is initiated:

```javascript
// Check if call is using OpenAI Realtime API
const isRealtimeMode = process.env.USE_OPENAI_REALTIME === 'true';

if (isRealtimeMode && global.activeMediaStreams.has(callId)) {
  const connection = global.activeMediaStreams.get(callId);

  // Close OpenAI WebSocket
  if (connection.openaiWs && connection.openaiWs.readyState === WebSocket.OPEN) {
    connection.openaiWs.close();
  }

  // Remove from global map
  global.activeMediaStreams.delete(callId);
}
```

### 2. Conference Room Creation
Create a unique conference room:
```javascript
const conferenceName = `handoff-${callId}`;
```

### 3. Agent Call Initiation
Call the human agent and add them to the conference:
```xml
<Response>
  <Play>お客様からのお電話です。接続します。</Play>
  <Dial>
    <Conference
      startConferenceOnEnter="true"
      endConferenceOnExit="true"
      record="record-from-start"
      recordingStatusCallback="${BASE_URL}/api/twilio/recording/status/${callId}"
      recordingStatusCallbackMethod="POST">${conferenceName}</Conference>
  </Dial>
</Response>
```

### 4. Customer Call Transition
Update customer's call to join the conference:
```javascript
await client.calls(callSession.twilioCallSid).update({
  twiml: `<Response>
    <Play>${audioUrl}</Play>
    <Dial>
      <Conference
        startConferenceOnEnter="false"
        endConferenceOnExit="false">${conferenceName}</Conference>
    </Dial>
  </Response>`
});
```

### 5. 3-Way Call Established
Result:
- ✅ Customer in Conference room
- ✅ Human agent in Conference room
- ✅ Recording active (from agent's call)
- ✅ AI completely disconnected

## Global WebSocket Connection Management

### Connection Map
```javascript
// In server.js
global.activeMediaStreams = new Map();
// Key: callId (string)
// Value: { twilioWs, openaiWs, streamSid }
```

### Registration
When Media Streams connection is established:
```javascript
global.activeMediaStreams.set(callId, {
  twilioWs,
  openaiWs,
  streamSid: null // Set when 'start' event received
});
```

### Cleanup
When connection closes:
```javascript
global.activeMediaStreams.delete(callId);
```

## API Endpoints

### POST /api/calls/:callId/handoff
Initiate handoff by callId (requires authentication).

**Request:**
```bash
curl -X POST http://localhost:5001/api/calls/:callId/handoff \
  -H "Authorization: Bearer ${TOKEN}"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "callId": "...",
    "handoffCallSid": "CA...",
    "status": "connecting",
    "agentPhoneNumber": "080****9355"
  }
}
```

### POST /api/calls/handoff-by-phone
Initiate handoff by phone number or callSid.

**Request:**
```bash
curl -X POST http://localhost:5001/api/calls/handoff-by-phone \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "09012345678"}'
```

## Call Status Flow

```
Media Streams (ai-responding)
    ↓
[Handoff Initiated]
    ↓
Media Streams Disconnected
OpenAI WebSocket Closed
    ↓
CallSession Status: transferring
    ↓
Agent Call Created → Conference
Customer Call Updated → Conference
    ↓
CallSession Status: human-connected
    ↓
[3-Way Call Active]
    ↓
Recording Continues
```

## Configuration

### Environment Variables
```bash
USE_OPENAI_REALTIME=true
OPENAI_REALTIME_API_KEY=sk-proj-...
BASE_URL=https://your-ngrok-url.ngrok.io
```

### User Settings
Users must have `handoffPhoneNumber` configured:
```javascript
{
  handoffPhoneNumber: "08070239355" // Japanese format
}
```

## WebSocket Events

### handoff-initiated
Broadcast when handoff starts:
```javascript
{
  event: 'handoff-initiated',
  callId: '...',
  agentId: '...',
  agentCallSid: 'CA...',
  timestamp: new Date()
}
```

### transcript-update
System message sent to frontend:
```javascript
{
  callId: '...',
  speaker: 'system',
  message: '担当者に接続中...',
  phoneNumber: '09012345678',
  timestamp: new Date()
}
```

## Testing

### Local Development
```bash
# 1. Start backend with OpenAI Realtime mode
cd backend
USE_OPENAI_REALTIME=true npm start

# 2. Make a test call to your Twilio number
# (Call will connect to OpenAI Realtime API)

# 3. Initiate handoff from frontend
# Click "担当者に引き継ぐ" button in call monitor

# 4. Verify:
# - Media Streams disconnected (check logs)
# - Agent receives call
# - Customer moved to Conference
# - 3-way call established
# - Recording continues
```

### Expected Logs
```
[Handoff] Starting handoff process
[Handoff] Realtime mode: true
[Handoff] Disconnecting Media Streams for OpenAI Realtime API call
[Handoff] Closing OpenAI WebSocket
[OpenAI] WebSocket closed
[MediaStream] Removed connection from global map: 123abc...
[Handoff] Media Streams disconnected
[Handoff] Creating conference call to agent +818070239355
[Handoff] Agent call created: CA...
[Handoff] Customer moved to conference successfully
```

## Troubleshooting

### Issue: Handoff fails silently
**Cause:** Media Streams WebSocket not properly closed
**Solution:** Check that `global.activeMediaStreams.delete(callId)` is called

### Issue: Customer hears silence after handoff
**Cause:** TwiML update failed or Conference not created
**Solution:**
- Verify `callSession.twilioCallSid` is valid
- Check that Conference TwiML is correctly formatted
- Ensure `BASE_URL` is set correctly for callbacks

### Issue: Recording stops after handoff
**Cause:** Conference recording not configured
**Solution:** Add `record="record-from-start"` to agent's Conference TwiML

### Issue: 3-way call not established
**Cause:** Agent and customer in different Conference rooms
**Solution:** Verify both use the same `conferenceName = handoff-${callId}`

## Future Enhancements

1. **Graceful AI farewell message** before disconnecting OpenAI
2. **Resume AI after handoff** if agent disconnects
3. **Warm transfer option** where agent and AI both talk to customer first
4. **Conference recording merge** with AI conversation recording
5. **WebRTC upgrade** for better audio quality in Conference

## References

- [Twilio Media Streams Documentation](https://www.twilio.com/docs/voice/twiml/stream)
- [Twilio Conference Documentation](https://www.twilio.com/docs/voice/twiml/conference)
- [OpenAI Realtime API Documentation](https://platform.openai.com/docs/guides/realtime)
