#!/bin/bash

# AI Call System - Startup Hook
echo "🚀 AI Call System Startup Hook"
echo "================================"

# プロジェクトルートに移動
cd "$(dirname "$0")/../.."

# 設定確認スクリプトを実行
echo "🔍 Running configuration check..."
node scripts/check-startup-config.js

echo ""
echo "📋 Quick Status Check:"
echo "   - Backend: http://localhost:5001"
echo "   - Frontend: http://localhost:3000"
echo "   - ngrok: $(curl -s localhost:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"[^"]*"' | cut -d'"' -f4 | head -1 || echo "Not running")"

echo ""
echo "💡 Recommended startup sequence:"
echo "   1. Start ngrok: ./tools/ngrok http 5001"
echo "   2. Check config: node scripts/check-startup-config.js"
echo "   3. Start backend: cd backend && npm start"
echo "   4. Start frontend: cd frontend && npm run dev"

echo "================================"