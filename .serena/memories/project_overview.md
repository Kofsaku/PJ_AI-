# AI Call System - Project Overview

## Purpose
AI-powered call system with Twilio integration for automated phone response system with real-time communication and agent management.

## Key Features
- AI voice dialogue for automated phone response
- Twilio integration for phone number management and call control
- Real-time conversation monitoring
- Operator handoff functionality
- Call history and statistics management
- Multi-tenant support (enterprise management)
- Bulk calling functionality

## Tech Stack
- **Backend**: Node.js/Express, MongoDB, Twilio SDK
- **Frontend**: Next.js with App Router, React
- **AI/Voice**: OpenAI API, CoeFont API (Japanese TTS)
- **Real-time**: WebSocket
- **Infrastructure**: ngrok (development), AWS S3 (optional)

## Architecture
- Backend API server on port 5001
- Frontend Next.js app on port 3000
- MongoDB database
- Twilio webhook integration
- CoeFont voice synthesis caching system (WAV format)