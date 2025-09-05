# AI Call System - Claude Code 設定

## Windowsパス変換について

ファイルを指定するときに、Windowsの形式のパスはubuntuのマウントディレクトリのパスに変換してください

例: `"C:\Users\user1\Pictures\7YR5STaA_400x400.jpg"` → `/mnt/c/Users/user1/Pictures/7YR5STaA_400x400.jpg`

## プロジェクト概要

AI-powered call system with Twilio integration, real-time communication, and agent management.

## 開発環境設定

### 起動前チェック
```bash
npm run check-config
```

### 推奨起動順序
1. ngrok起動: `./tools/ngrok http 5001`
2. 設定確認: `node scripts/check-startup-config.js` 
3. バックエンド起動: `cd backend && npm start`
4. フロントエンド起動: `cd frontend && npm run dev`

## 重要な設定ファイル
- `backend/.env` - 環境変数（ngrok URL等）
- `backend/config/templates.js` - 会話テンプレート
- `backend/models/AgentSettings.js` - エージェント設定

## トラブルシューティング
- 通話エラー時: ngrok URLの確認と.env更新
- webhook失敗時: BASE_URLとNGROK_URLの一致確認