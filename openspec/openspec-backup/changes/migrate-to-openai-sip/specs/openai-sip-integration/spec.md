## ADDED Requirements

### Requirement: SIP Call Forwarding
The system SHALL forward incoming Twilio calls to OpenAI SIP endpoint using TwiML `<Dial><Sip>` instruction.

#### Scenario: Call forwarded to OpenAI
- **WHEN** Twilio receives an incoming call and `USE_OPENAI_SIP=true`
- **THEN** system returns TwiML with `<Sip>sip:{PROJECT_ID}@sip.api.openai.com;transport=tls</Sip>`

#### Scenario: Legacy mode preserved
- **WHEN** `USE_OPENAI_SIP=false`
- **THEN** system returns TwiML with Media Streams `<Stream>` instruction

### Requirement: OpenAI Webhook Reception
The system SHALL receive and process `realtime.call.incoming` webhook events from OpenAI Platform.

#### Scenario: Valid webhook received
- **WHEN** OpenAI sends `realtime.call.incoming` webhook with valid signature
- **THEN** system extracts `call_id` and verifies signature
- **AND** system responds with 200 status

#### Scenario: Invalid signature rejected
- **WHEN** webhook signature verification fails
- **THEN** system returns 401 Unauthorized
- **AND** system logs anonymized failure details

#### Scenario: Expired timestamp rejected
- **WHEN** webhook timestamp is older than 5 minutes
- **THEN** system returns 401 Unauthorized
- **AND** system logs replay attack attempt

### Requirement: Call Accept API
The system SHALL accept calls via OpenAI Accept Call REST API within 10 seconds of webhook receipt.

#### Scenario: Call accepted with session config
- **WHEN** valid webhook is received
- **THEN** system sends POST to `/v1/realtime/calls/{call_id}/accept`
- **AND** includes model, modalities, instructions, voice, tools configuration
- **AND** receives session ID in response

#### Scenario: Call accept timeout
- **WHEN** call accept takes longer than 30 seconds
- **THEN** system logs timeout error
- **AND** attempts to reject call

#### Scenario: Session configuration from database
- **WHEN** accepting call
- **THEN** system loads agent template from CallSession
- **AND** includes template instructions in session config
- **AND** includes agent tools in session config

### Requirement: Sideband WebSocket Connection
The system SHALL establish sideband WebSocket connection for session control and tool calling.

#### Scenario: Sideband connection established
- **WHEN** call is accepted successfully
- **THEN** system connects to `wss://api.openai.com/v1/realtime?call_id={call_id}`
- **AND** authenticates with OpenAI API key
- **AND** receives session.created event

#### Scenario: Tool call via sideband
- **WHEN** OpenAI sends function call request via sideband
- **THEN** system executes tool function
- **AND** sends result back via sideband WebSocket

#### Scenario: Sideband reconnection
- **WHEN** sideband WebSocket disconnects unexpectedly
- **THEN** system attempts to reconnect once
- **AND** logs reconnection attempt

### Requirement: Call Session Data Persistence
The system SHALL store OpenAI call identifiers in CallSession model for tracking.

#### Scenario: OpenAI call ID stored
- **WHEN** call is accepted
- **THEN** system stores `openaiCallId` in CallSession document
- **AND** links it to existing `twilioCallSid`

#### Scenario: Recording and transcript saved
- **WHEN** call completes
- **THEN** system saves recording URL if available
- **AND** saves conversation item transcripts with timestamps

### Requirement: Environment Configuration
The system SHALL require environment variables for SIP integration.

#### Scenario: Required config validation
- **WHEN** `USE_OPENAI_SIP=true` and server starts
- **THEN** system validates `OPENAI_PROJECT_ID` exists
- **AND** validates `OPENAI_WEBHOOK_SECRET` exists
- **AND** fails to start if missing

#### Scenario: Feature flag controls behavior
- **WHEN** `USE_OPENAI_SIP=true`
- **THEN** system uses SIP integration
- **WHEN** `USE_OPENAI_SIP=false`
- **THEN** system uses legacy Media Streams integration

### Requirement: Audio Direct Flow
The system SHALL NOT process audio data in backend - audio flows directly between phone and OpenAI.

#### Scenario: Audio bypasses backend
- **WHEN** call is in progress
- **THEN** audio streams directly via SIP connection
- **AND** backend does not receive audio buffers
- **AND** backend only controls session via sideband

### Requirement: Japanese Speech Recognition
The system SHALL support Japanese language speech recognition via OpenAI Realtime API.

#### Scenario: Japanese speech transcribed
- **WHEN** user speaks Japanese during call
- **THEN** OpenAI transcribes speech correctly
- **AND** transcript is available in conversation items

### Requirement: Webhook Signature Verification
The system SHALL verify all incoming webhooks using HMAC-SHA256 signature verification.

#### Scenario: Signature computed and compared
- **WHEN** webhook is received
- **THEN** system extracts `openai-webhook-signature` header
- **AND** computes HMAC-SHA256 of raw request body with webhook secret
- **AND** compares using timing-safe comparison

#### Scenario: Missing signature header
- **WHEN** webhook lacks `openai-webhook-signature` header
- **THEN** system returns 401 Unauthorized

### Requirement: Error Handling and Logging
The system SHALL log all webhook events and errors for debugging.

#### Scenario: Successful webhook logged
- **WHEN** valid webhook is processed
- **THEN** system logs call_id and event type
- **AND** does NOT log secrets or signatures

#### Scenario: Error logged securely
- **WHEN** call accept fails
- **THEN** system logs error with call_id
- **AND** does NOT expose sensitive data in logs
