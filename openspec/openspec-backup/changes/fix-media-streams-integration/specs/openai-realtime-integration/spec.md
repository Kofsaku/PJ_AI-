# OpenAI Realtime Integration Specification Deltas

## ADDED Requirements

### Requirement: Media Streams Audio Format Configuration
The system SHALL configure OpenAI Realtime API session with audio/pcmu (μ-law) format for both input and output to match Twilio Media Streams format.

#### Scenario: Session initialization with correct audio format
- **WHEN** establishing OpenAI WebSocket connection
- **THEN** system sends `session.update` message
- **AND** sets `audio.input.format = { type: "audio/pcmu" }`
- **AND** sets `audio.output.format = { type: "audio/pcmu" }`
- **AND** receives `session.created` confirmation

#### Scenario: Audio data flows without transcoding
- **WHEN** Twilio sends media event with base64-encoded μ-law audio
- **THEN** system forwards audio to OpenAI via `input_audio_buffer.append` without re-encoding
- **WHEN** OpenAI sends `response.output_audio.delta` with base64-encoded μ-law
- **THEN** system forwards audio to Twilio without re-encoding

### Requirement: Server-side Voice Activity Detection
The system SHALL configure server-side VAD (Voice Activity Detection) in OpenAI session to enable natural conversation flow.

#### Scenario: VAD configuration in session
- **WHEN** initializing OpenAI session
- **THEN** system sets `audio.input.turn_detection = { type: "server_vad" }`
- **AND** OpenAI detects when user starts and stops speaking
- **AND** OpenAI automatically generates responses after user stops

### Requirement: Interrupt Handling
The system SHALL implement interrupt handling to allow users to interrupt AI responses mid-speech.

#### Scenario: User interrupts AI response
- **WHEN** OpenAI sends `input_audio_buffer.speech_started` event
- **THEN** system sends `clear` event to Twilio Media Streams buffer
- **AND** system sends `conversation.item.truncate` to OpenAI with current audio position
- **AND** system clears mark queue and resets tracking variables
- **AND** AI stops speaking immediately

#### Scenario: Calculate truncation timestamp
- **WHEN** user interrupts AI response
- **THEN** system calculates `audio_end_ms = latest_media_timestamp - response_start_timestamp`
- **AND** includes `audio_end_ms` in truncate message
- **AND** OpenAI truncates response at exact position

### Requirement: Session Configuration Message Format
The system SHALL use `session.update` message format (not REST API) to configure OpenAI Realtime session.

#### Scenario: Correct session update format
- **WHEN** WebSocket connection to OpenAI is established
- **THEN** system sends message with `type: "session.update"`
- **AND** includes `session.model = "gpt-realtime"`
- **AND** includes `session.output_modalities = ["audio"]`
- **AND** includes `session.audio` configuration object
- **AND** includes `session.instructions` with agent system prompt
- **AND** does NOT use Accept API or call_id parameters

### Requirement: Mark Queue for Response Tracking
The system SHALL maintain a mark queue to track response boundaries for accurate interrupt handling.

#### Scenario: Send marks with audio deltas
- **WHEN** sending audio delta to Twilio
- **THEN** system sends mark event after each audio chunk
- **AND** adds mark to queue
- **WHEN** Twilio confirms mark receipt
- **THEN** system removes mark from queue

#### Scenario: Clear marks on interrupt
- **WHEN** user interrupts AI response
- **THEN** system clears all marks from queue
- **AND** resets last assistant item tracking

## MODIFIED Requirements

### Requirement: OpenAI WebSocket Connection URL
The system SHALL connect to OpenAI Realtime API using the correct WebSocket URL with model parameter.

**Modified from**: Connection without explicit model parameter
**Modified to**: Connection with model in URL query string

#### Scenario: WebSocket connection with model parameter
- **WHEN** establishing OpenAI connection
- **THEN** system connects to `wss://api.openai.com/v1/realtime?model=gpt-realtime`
- **AND** includes Authorization header with Bearer token
- **AND** does NOT use call_id parameter (not needed for Media Streams)

### Requirement: Environment Variable Configuration
The system SHALL use simplified environment variables for Media Streams integration.

**Modified from**: SIP-specific configuration with PROJECT_ID and WEBHOOK_SECRET
**Modified to**: Media Streams configuration with API key only

#### Scenario: Required environment variables
- **WHEN** server starts with `USE_OPENAI_REALTIME=true`
- **THEN** system requires `OPENAI_REALTIME_API_KEY`
- **AND** does NOT require `OPENAI_PROJECT_ID`
- **AND** does NOT require `OPENAI_WEBHOOK_SECRET`
- **AND** does NOT require `USE_OPENAI_SIP`

## REMOVED Requirements

### Requirement: SIP Integration
**Reason**: OpenAI Realtime API + Twilio uses Media Streams, not SIP. SIP integration is incorrect architecture.
**Migration**: Remove all SIP-related code and configuration. Revert to Media Streams approach per official Twilio sample.

#### Original requirement text:
The system SHALL forward incoming Twilio calls to OpenAI SIP endpoint using TwiML `<Dial><Sip>` instruction.

### Requirement: OpenAI Webhook Handling
**Reason**: Media Streams approach does not use OpenAI webhooks. Only SIP integration uses webhooks.
**Migration**: Remove webhook routes, signature verification, and call accept/reject logic.

#### Original requirement text:
The system SHALL receive and process `realtime.call.incoming` webhook events from OpenAI Platform.

### Requirement: Call Accept/Reject API
**Reason**: Accept API is only for SIP integration. Media Streams uses WebSocket session.update instead.
**Migration**: Replace Accept API calls with session.update WebSocket messages.

#### Original requirement text:
The system SHALL accept calls via OpenAI Accept Call REST API within 10 seconds of webhook receipt.

### Requirement: Sideband WebSocket Connection
**Reason**: Media Streams uses single WebSocket for both audio and control. No separate "sideband" needed.
**Migration**: Use main WebSocket connection for all communication.

#### Original requirement text:
The system SHALL establish sideband WebSocket connection for session control and tool calling.
