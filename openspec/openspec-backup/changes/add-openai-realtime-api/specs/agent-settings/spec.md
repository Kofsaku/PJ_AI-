# Agent Settings Specification Deltas

## ADDED Requirements

### Requirement: Realtime API Configuration in Sales Pitch Settings
The system SHALL provide GUI controls in the Sales Pitch settings page for configuring OpenAI Realtime API parameters.

#### Scenario: Configure Realtime voice settings
- **GIVEN** a user is on the Sales Pitch settings page (`/settings/sales-pitch`)
- **WHEN** they access the "Realtime API設定" section
- **THEN** they SHALL see controls for:
  - Voice selection (dropdown: alloy, echo, fable, onyx, nova, shimmer)
  - Speech speed (slider: 0.5x - 2.0x)
  - Temperature (slider: 0.0 - 1.0)
  - Model selection (dropdown: gpt-4o-realtime-preview, gpt-4o-mini-realtime)

#### Scenario: Edit system prompt for conversations
- **GIVEN** a user is configuring Realtime API settings
- **WHEN** they edit the "システムプロンプト" textarea
- **THEN** the prompt SHALL be saved to `AgentSettings.realtimeInstructions`
- **AND** the prompt SHALL be used to initialize Realtime API sessions

#### Scenario: Toggle between old and new conversation engine
- **GIVEN** a user wants to test Realtime API without affecting production calls
- **WHEN** they toggle the "Realtime APIを有効化" switch
- **THEN** the system SHALL update `AgentSettings.useRealtimeAPI` flag
- **AND** subsequent calls SHALL use the selected conversation engine

### Requirement: Backward Compatibility with Existing Settings
The system SHALL preserve existing conversation settings when migrating to Realtime API.

#### Scenario: Automatic migration of legacy settings
- **GIVEN** an existing agent with legacy conversation settings
- **WHEN** Realtime API is enabled for the first time
- **THEN** the system SHALL convert:
  - `conversationSettings.companyName` → system prompt variable
  - `conversationSettings.salesPitch` → embedded in instructions
  - Coefont voice settings → OpenAI voice mapping (default: "alloy")

#### Scenario: Fallback to legacy mode
- **GIVEN** Realtime API is disabled via feature flag or UI toggle
- **WHEN** a call is initiated
- **THEN** the system SHALL fall back to ConversationEngine
- **AND** use existing template-based responses

## MODIFIED Requirements

### Requirement: Agent Settings Data Model
The `AgentSettings` model SHALL include new fields for Realtime API configuration while preserving legacy fields.

**Previous**: Only supported Coefont voice settings and template-based conversation
**New**: Supports both legacy and Realtime API configurations

#### Scenario: Store Realtime API settings
- **GIVEN** a user saves Realtime API settings
- **WHEN** the settings are persisted to MongoDB
- **THEN** the document SHALL include:
  - `useRealtimeAPI`: Boolean (default: false)
  - `realtimeVoice`: String (alloy|echo|fable|onyx|nova|shimmer)
  - `realtimeSpeed`: Number (0.5 - 2.0)
  - `realtimeTemperature`: Number (0.0 - 1.0)
  - `realtimeModel`: String (default: "gpt-4o-realtime-preview")
  - `realtimeInstructions`: String (system prompt)
- **AND** legacy fields SHALL remain unchanged:
  - `conversationSettings.companyName`
  - `conversationSettings.salesPitch`

#### Scenario: Retrieve settings for call initialization
- **GIVEN** a call is being initiated
- **WHEN** the system loads agent settings
- **THEN** it SHALL check `useRealtimeAPI` flag
- **AND** load appropriate configuration (Realtime API or legacy)
