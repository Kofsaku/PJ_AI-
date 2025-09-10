# AI Call System - Startup Configuration Check

このプロジェクトの起動時には以下の設定確認が必要です：

## 必要な確認項目

1. **ngrok トンネルURL**
   - ngrok が起動しているか
   - .env ファイルの `NGROK_URL` と `BASE_URL` が最新のngrok URLと一致しているか

2. **サーバー状態**
   - バックエンドサーバー (port 5001)
   - フロントエンドサーバー (port 3000)
   - ngrok トンネル

3. **Twilio Webhook設定**
   - webhook URLが正しく設定されているか

## 自動チェックコマンド

```bash
# 設定確認とエラーの自動修正
node scripts/check-startup-config.js

# サーバー開始（推奨順序）
npm run start-all
```

## よくある問題

- **通話時にアプリケーションエラー**: ngrok URLが古い可能性
- **webhook接続失敗**: BASE_URLとngrok URLの不一致
- **接続が突然切断**: 開発環境での一斉起動によるタイムアウト

## 解決方法

1. ngrok を先に起動
2. 設定確認スクリプトを実行
3. バックエンド → フロントエンドの順で起動