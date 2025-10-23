# 🚀 初期確認事項 - 必ず最初に読むこと

このファイルは Claude Code セッション開始時に必ず確認してください。

## 📋 環境設定の重要な注意事項

### 1. ポート設定
- **Frontend**: `3000`
- **Backend**: `5000`
- **ngrok**: `5000` にトンネル接続

### 2. 環境変数ファイル（ngrok URL更新が必要）

起動前に以下の3つのファイルのngrok URLを更新してください:

1. **backend/.env**
   - `NGROK_URL`
   - `BASE_URL`

2. **backend/.env.local**
   - `WEBHOOK_BASE_URL_DEV`
   - `NGROK_URL`
   - `BASE_URL`

3. **frontend/.env.local**
   - `NEXT_PUBLIC_BACKEND_NGROK_URL`

### 3. 起動手順（必ずこの順序で）

```bash
# 1. ngrok起動（別ターミナル）
ngrok http 5000

# 2. ngrok URLを取得
curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"https://[^"]*"' | head -1 | cut -d'"' -f4

# 3. 上記3つのファイルのngrok URLを更新

# 4. バックエンド起動
cd backend
npm start  # または npm run dev

# 5. フロントエンド起動（別ターミナル）
cd frontend
npm run dev
```

### 4. Windowsパス変換

ファイルパス指定時は必ず変換してください:
- Windows: `C:\Users\user1\Pictures\image.jpg`
- Ubuntu: `/mnt/c/Users/user1/Pictures/image.jpg`

## 🔍 確認用コマンド

```bash
# ポート使用状況確認
netstat -tlnp | grep -E ':(3000|5000|4040)'

# ngrok URL確認
curl -s http://localhost:4040/api/tunnels

# バックエンドログ確認
tail -f /tmp/backend.log

# フロントエンドログ確認
tail -f /tmp/frontend.log
```

## 📚 関連ドキュメント

- [startup-check.md](.claude/startup-check.md) - 詳細な起動チェックリスト
- [CLAUDE.md](../CLAUDE.md) - プロジェクト全体の設定
- [development-strategy.md](.claude/development-strategy.md) - 開発戦略

## ⚠️ トラブルシューティング

### ngrok URLが古い場合
1. 3つの環境変数ファイルすべてを更新
2. バックエンドを再起動（フロントエンドは不要）

### ポートが使用中の場合
```bash
# ポートを開放
lsof -ti:5000 | xargs kill -9
lsof -ti:3000 | xargs kill -9
```

### MongoDB接続エラー
- `.env`の`MONGODB_URI`を確認
- ネットワーク接続を確認
