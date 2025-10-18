# Voice Processing Specification Deltas

## ADDED Requirements

### Requirement: OpenAI Realtime API Integration
The system SHALL integrate OpenAI Realtime API for unified voice recognition, conversation, and synthesis processing.

#### Scenario: Realtime API connection establishment
- **GIVEN** a new call is initiated via Twilio
- **WHEN** Twilio Media Streams connects to the backend WebSocket endpoint
- **THEN** the system SHALL establish a WebSocket connection to OpenAI Realtime API
- **AND** configure the session with agent settings (voice, instructions, temperature)

#### Scenario: Bidirectional audio streaming
- **GIVEN** an active OpenAI Realtime API session
- **WHEN** audio data is received from Twilio Media Streams
- **THEN** the system SHALL forward the audio to OpenAI in base64-encoded format
- **AND** receive synthesized speech from OpenAI
- **AND** stream the response back to Twilio in real-time

#### Scenario: Session cleanup on call end
- **GIVEN** an active Realtime API session
- **WHEN** the Twilio call ends or times out
- **THEN** the system SHALL gracefully close the OpenAI WebSocket connection
- **AND** release all associated resources

### Requirement: High-Precision Japanese Voice Recognition
The system SHALL use OpenAI Whisper model for Japanese speech-to-text with 95%+ accuracy.

#### Scenario: Accurate Japanese transcription
- **GIVEN** a customer speaks in Japanese during a call
- **WHEN** audio is processed by OpenAI Realtime API
- **THEN** the transcription accuracy SHALL be at least 95%
- **AND** transcription results SHALL be available in real-time (<200ms latency)

### Requirement: Low-Latency Voice Synthesis
The system SHALL use OpenAI TTS for generating natural Japanese speech with minimal latency.

#### Scenario: Fast response generation
- **GIVEN** GPT-4o generates a conversation response
- **WHEN** the text is sent to OpenAI TTS
- **THEN** synthesized audio SHALL be ready within 300ms
- **AND** audio quality SHALL be natural and human-like

## REMOVED Requirements

### Requirement: Coefont TTS Integration
**Reason**: Replaced by OpenAI Realtime API's built-in TTS capability
**Migration**: All Coefont API calls will be replaced with OpenAI TTS. Existing voice cache files will be deprecated.

#### Scenario: Generate speech with Coefont API
[REMOVED - no longer applicable]

### Requirement: Twilio Speech Recognition
**Reason**: Replaced by OpenAI Whisper for superior accuracy
**Migration**: Twilio Media Streams will be used for audio transport only, not recognition.

## MODIFIED Requirements

### Requirement: Audio Streaming Architecture
The system SHALL support bidirectional audio streaming between Twilio and OpenAI Realtime API.

**Previous**: Audio was processed in discrete steps (recognition → text → synthesis)
**New**: Audio is streamed continuously in both directions via WebSocket

#### Scenario: Continuous audio flow
- **GIVEN** an active call with Twilio Media Streams enabled
- **WHEN** the customer speaks
- **THEN** raw audio SHALL be streamed to OpenAI in real-time
- **AND** synthesized responses SHALL be streamed back to Twilio without buffering delays

#### Scenario: Latency monitoring
- **GIVEN** an active Realtime API session
- **WHEN** audio round-trip time is measured
- **THEN** end-to-end latency SHALL not exceed 500ms for 95% of interactions
