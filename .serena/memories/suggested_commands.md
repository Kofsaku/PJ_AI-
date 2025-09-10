# Suggested Commands

## Development Environment
- `npm run check-config` - Check configuration before startup
- `./tools/ngrok http 5001` - Start ngrok tunnel for Twilio webhooks
- `node scripts/check-startup-config.js` - Verify startup configuration

## Backend Commands
- `cd backend && npm start` - Start backend server
- `cd backend && npm run dev` - Start backend with auto-reload
- `node setup-agent.js` - Create admin account
- `node scripts/createDefaultCompany.js` - Create default company

## Frontend Commands
- `cd frontend && npm run dev` - Start frontend development server
- `cd frontend && npm run build` - Build for production
- `cd frontend && npm run lint` - Run linting

## Database Operations
- `brew services start mongodb-community` - Start MongoDB (macOS)
- `sudo systemctl start mongodb` - Start MongoDB (Linux)

## Testing
- `node test-twilio-direct.js` - Test Twilio integration
- `node test-coefont.js` - Test CoeFont voice synthesis

## System Startup (Recommended Order)
1. Start MongoDB
2. Start ngrok tunnel
3. Update .env with ngrok URL
4. Start backend server
5. Start frontend server