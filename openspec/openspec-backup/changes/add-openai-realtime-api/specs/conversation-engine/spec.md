# Conversation Engine Specification Deltas

## MODIFIED Requirements

### Requirement: AI Conversation Management
The system SHALL use GPT-4o via OpenAI Realtime API for natural, context-aware conversation management.

**Previous**: Rule-based conversation engine with keyword matching and template selection
**New**: GPT-4o powered conversation with continuous context tracking

#### Scenario: Natural conversation flow
- **GIVEN** a customer is on a call with the AI agent
- **WHEN** the customer asks a question or provides information
- **THEN** GPT-4o SHALL generate a contextually appropriate response
- **AND** maintain conversation history for coherent multi-turn dialogue

#### Scenario: Agent personality and instructions
- **GIVEN** an agent with custom settings (personality, tone, instructions)
- **WHEN** a call session is initiated
- **THEN** the system SHALL configure GPT-4o with agent-specific system prompts
- **AND** maintain consistent personality throughout the conversation

#### Scenario: Goal-oriented conversation
- **GIVEN** an agent configured with specific conversation goals (e.g., appointment booking)
- **WHEN** GPT-4o generates responses
- **THEN** responses SHALL guide the conversation toward the defined goal
- **AND** extract required information (name, date, time, etc.)

### Requirement: Conversation State Tracking
The system SHALL maintain real-time conversation state via OpenAI Realtime API session context.

**Previous**: Manual state management in backend service
**New**: Leverages OpenAI's built-in conversation context

#### Scenario: Context persistence
- **GIVEN** a multi-turn conversation
- **WHEN** the customer refers to previously mentioned information
- **THEN** GPT-4o SHALL correctly reference past context
- **AND** avoid asking for already-provided information

#### Scenario: State synchronization with backend
- **GIVEN** an active Realtime API session
- **WHEN** conversation events occur (new turn, information extracted)
- **THEN** the system SHALL emit WebSocket events to frontend for real-time monitoring
- **AND** update database records (CallSession, transcription)

## REMOVED Requirements

### Requirement: Template-Based Response Selection
**Reason**: GPT-4o generates dynamic responses, eliminating the need for predefined templates
**Migration**: Existing templates in `backend/config/templates.js` will be converted to GPT-4o system prompts

#### Scenario: Select response template based on keywords
[REMOVED - no longer applicable]

### Requirement: Keyword Matching Logic
**Reason**: GPT-4o understands intent without explicit keyword matching
**Migration**: Keyword lists can be incorporated into system prompts if needed for specific use cases

## ADDED Requirements

### Requirement: Realtime Function Calling
The system SHALL support OpenAI Realtime API function calling for dynamic actions during conversation.

#### Scenario: Trigger operator handoff via function call
- **GIVEN** GPT-4o determines the customer needs human assistance
- **WHEN** GPT-4o invokes the `request_operator_handoff` function
- **THEN** the system SHALL initiate the handoff process
- **AND** notify the operator dashboard via WebSocket

#### Scenario: Database lookup during conversation
- **GIVEN** GPT-4o needs customer information
- **WHEN** GPT-4o invokes the `get_customer_info` function with phone number
- **THEN** the system SHALL query the database and return results to GPT-4o
- **AND** GPT-4o SHALL incorporate the information into the next response

### Requirement: Conversation Quality Monitoring
The system SHALL log and analyze GPT-4o conversation metrics for quality assurance.

#### Scenario: Track conversation success rate
- **GIVEN** a completed call
- **WHEN** conversation data is analyzed
- **THEN** the system SHALL store metrics (turns, goal completion, handoff rate)
- **AND** make metrics available in the admin dashboard
