# Project Context

## Purpose
AI-powered automated call system with Twilio integration for handling voice calls, real-time conversation monitoring, and operator handoff functionality. The system supports multi-tenant architecture with company management features and bulk calling capabilities.

## Tech Stack

### Backend
- **Runtime**: Node.js 18.0.0+
- **Framework**: Express 5.1.0
- **Database**: MongoDB 4.4+ with Mongoose 8.16.4
- **Real-time Communication**: Socket.IO 4.8.1
- **Telephony**: Twilio 5.8.0
- **Authentication**: JWT (jsonwebtoken 9.0.2) + bcryptjs
- **Security**: Helmet 8.1.0, CORS
- **Logging**: Morgan
- **File Upload**: Multer 2.0.2
- **Email**: Nodemailer 6.10.1
- **Development**: Nodemon 3.1.10

### Frontend
- **Framework**: Next.js 15.2.4 (App Router)
- **Runtime**: React 19
- **Language**: TypeScript 5
- **UI Components**: Radix UI (Dialog, Dropdown, Select, Toast, etc.)
- **Styling**: Tailwind CSS 3.4.17
- **Forms**: React Hook Form 7.54.1 + Zod 3.24.1
- **HTTP Client**: Axios 1.11.0
- **Real-time**: Socket.IO Client 4.8.1
- **Date Handling**: date-fns 4.1.0
- **Charts**: Recharts 2.15.0
- **Icons**: Lucide React 0.454.0
- **Theming**: next-themes 0.4.4

### External Services
- **Twilio**: Voice API, Conference API, Recording
- **OpenAI**: AI conversation engine
- **Coefont**: TTS (Text-to-Speech) service
- **AWS S3**: Audio file storage (optional)
- **ngrok**: Local development webhook tunneling

## Project Conventions

### Code Style
- **JavaScript**: Standard ES6+ syntax with CommonJS modules (backend)
- **TypeScript**: Strict typing enabled (frontend)
- **Naming Conventions**:
  - Files: camelCase for JS, kebab-case for routes
  - Components: PascalCase (React)
  - Variables/Functions: camelCase
  - Constants: UPPER_SNAKE_CASE
  - Database Models: PascalCase with Schema suffix
- **Formatting**: Consistent indentation (2 spaces)
- **File Organization**:
  - Backend: controllers/, models/, routes/, services/, middlewares/
  - Frontend: app/ (App Router), components/, lib/

### Architecture Patterns
- **Backend**:
  - MVC pattern with controllers and services
  - Middleware-based request processing
  - WebSocket service for real-time updates
  - Service layer pattern (twilioService, conversationEngine, etc.)
  - Route-based API organization
  - Centralized error handling
- **Frontend**:
  - Next.js App Router architecture
  - Component-based design with Radix UI
  - Server/Client component separation
  - API routes for backend communication
  - Real-time updates via Socket.IO
- **Database**:
  - Mongoose schemas with validation
  - Multi-tenant support via Company model
  - User-based data isolation
- **Communication**:
  - REST API for CRUD operations
  - WebSocket for real-time call monitoring
  - Webhook endpoints for Twilio callbacks

### Testing Strategy
- Manual testing for core features
- No automated test suite currently implemented
- Test routes available at `/api/test` for debugging

### Git Workflow
- **Main Branch**: `main`
- **Feature Branches**: Use descriptive names (e.g., `fix_merge`, `feature/bulk-call`)
- **Commit Messages**: Descriptive Japanese commit messages
- **Pull Requests**: Required for merging to main
- **Recent Commits**: Focus on UI refinement, bug fixes, and feature cleanup

## Domain Context

### Call System Workflow
1. **User Setup**: Company admin creates agents and imports customer data
2. **Call Initiation**: Single or bulk call initiation via dashboard
3. **AI Conversation**: Coefont TTS + OpenAI for natural conversation
4. **Real-time Monitoring**: WebSocket-based call status updates
5. **Operator Handoff**: Manual intervention when needed
6. **Call History**: Complete recording and transcription storage

### Key Concepts
- **Agent**: AI voice agent with configurable settings and conversation templates
- **Customer**: Call recipients with contact information and metadata
- **Call Session**: Individual call instance with state tracking
- **Conference**: Twilio conference for operator handoff
- **Phone Pool**: Managed pool of Twilio phone numbers
- **Multi-tenant**: Multiple companies sharing the same system

### User Roles
- **System Admin**: Full system access, company management
- **Company Admin**: Company-level user and agent management
- **Agent/User**: Standard user with call initiation rights

## Important Constraints

### Technical Constraints
- **Node.js Version**: Requires 18.0.0 or higher
- **MongoDB**: Local instance required for development
- **ngrok**: Required for local Twilio webhook development
- **Port Usage**: Backend (5001), Frontend (3000)
- **Environment Variables**: Separate .env files for backend/frontend
- **Windows Paths**: Must be converted to WSL mount paths (e.g., `C:\` → `/mnt/c/`)

### Business Constraints
- **Twilio Account**: Required with purchased phone numbers
- **API Keys**: OpenAI, Coefont access keys mandatory
- **Call Costs**: Twilio usage-based pricing
- **Recording Storage**: S3 recommended for production

### Security Constraints
- **JWT Authentication**: All protected routes require valid tokens
- **CORS**: Strict origin validation in production
- **Password Hashing**: bcryptjs with secure rounds
- **Environment Secrets**: Never commit .env files

## External Dependencies

### Required Services
- **Twilio**:
  - Voice API: Call initiation and control
  - Conference API: Operator handoff
  - Recording API: Call recording storage
  - Webhooks: `/api/twilio/voice`, `/api/twilio/status-callback`
- **OpenAI API**: Conversation intelligence
- **Coefont API**: Japanese TTS synthesis
- **MongoDB**: Primary data store

### Optional Services
- **AWS S3**: Recording storage (can use local storage)
- **ngrok**: Development webhook tunneling (local only)

### Critical Configuration Files
- `backend/.env`: All API keys, database URLs, webhook URLs
- `backend/config/templates.js`: Conversation templates
- `backend/models/AgentSettings.js`: Agent configuration schema
- `frontend/.env.local`: Frontend API endpoints and feature flags

## Startup Procedure

### Recommended Order
1. **MongoDB**: Ensure running (`brew services start mongodb-community`)
2. **ngrok**: `./tools/ngrok http 5001` (get HTTPS URL)
3. **Backend .env**: Update `NGROK_URL` and `WEBHOOK_BASE_URL_DEV`
4. **Config Check**: `npm run check-config` (from root)
5. **Backend**: `cd backend && npm start`
6. **Frontend**: `cd frontend && npm run dev`

### Important Paths
- Backend API: http://localhost:5001
- Frontend: http://localhost:3000
- Admin Dashboard: http://localhost:3000/admin
- Health Check: http://localhost:5001/health

## Notes for AI Assistants
- Always use Japanese for documentation and commit messages
- Convert Windows paths to WSL format when working with files
- Verify ngrok URL is updated in .env before testing calls
- Use existing file editing over creating new files
- Check Twilio webhook configuration for call-related issues
