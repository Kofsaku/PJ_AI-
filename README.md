# AI Call System - 自動電話対応システム

AIを活用した自動電話対応システムです。Twilioを利用した音声通話、リアルタイム会話処理、オペレーターへのハンドオフ機能を提供します。

## 機能概要

- 🤖 AI音声対話による自動電話対応
- 📞 Twilioを利用した電話番号管理と通話制御
- 🔄 リアルタイムでの会話モニタリング
- 👥 オペレーターへのハンドオフ機能
- 📊 通話履歴と統計情報の管理
- 🏢 マルチテナント対応（企業管理機能）
- 🎯 一括発信機能

## プロジェクト構造

```
PJ_AI-/
├── backend/            # Node.js/Express バックエンドサーバー
│   ├── controllers/    # APIコントローラー
│   ├── models/        # MongoDBモデル
│   ├── routes/        # APIルート定義
│   ├── services/      # ビジネスロジック
│   └── server.js      # メインサーバーファイル
├── frontend/          # Next.js フロントエンド
│   ├── app/          # App Router
│   ├── components/   # Reactコンポーネント
│   └── lib/          # ユーティリティ関数
└── docs/             # ドキュメント
```

## 必要な要件

- Node.js 18.0.0以上
- MongoDB 4.4以上
- Twilioアカウント
- OpenAI APIキー
- Coefont APIキー（音声合成用）
- ngrok（ローカル開発用）

## ローカル環境セットアップ手順

### 1. リポジトリのクローン

```bash
git clone <repository-url>
cd PJ_AI-
```

### 2. MongoDB のセットアップ

#### macOS の場合：
```bash
# Homebrewを使用してインストール
brew tap mongodb/brew
brew install mongodb-community

# MongoDBを起動
brew services start mongodb-community
```

#### Windows の場合：
[MongoDB公式サイト](https://www.mongodb.com/try/download/community)からインストーラーをダウンロードして実行

#### Linux の場合：
```bash
# Ubuntu/Debian
sudo apt-get install -y mongodb
sudo systemctl start mongodb
```

### 3. バックエンドのセットアップ

```bash
cd backend

# 依存関係のインストール
npm install

# 環境変数ファイルの作成
cp .env.example .env
```

#### .env ファイルの設定

`backend/.env` ファイルを編集して、以下の環境変数を設定：

```env
# 基本設定
NODE_ENV=development
PORT=5001

# MongoDB接続
MONGODB_URI=mongodb://localhost:27017/ai-call-system

# JWT認証
JWT_SECRET=your-jwt-secret-key-here

# Twilio設定
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_PHONE_NUMBER_DEV=+1xxxxxxxxxx  # Twilioで購入した番号

# ngrok URL（後で設定）
NGROK_URL=https://your-ngrok-url.ngrok-free.app
WEBHOOK_BASE_URL_DEV=https://your-ngrok-url.ngrok-free.app

# OpenAI API
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Coefont API（音声合成）
COEFONT_ACCESS_KEY=your-coefont-access-key
COEFONT_CLIENT_SECRET=your-coefont-secret

# AWS S3（オプション：音声ファイル保存用）
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-s3-bucket
```

### 4. フロントエンドのセットアップ

```bash
cd ../frontend

# 依存関係のインストール
npm install

# 環境変数ファイルの作成
cp .env.example .env.local
```

#### .env.local ファイルの設定

`frontend/.env.local` ファイルを編集：

```env
# 環境設定
NEXT_PUBLIC_NODE_ENV=development

# API URLs
NEXT_PUBLIC_API_URL_DEV=http://localhost:5001
NEXT_PUBLIC_API_URL_PROD=https://your-production-api.com

# WebSocket URLs
NEXT_PUBLIC_WS_URL_DEV=ws://localhost:5001
NEXT_PUBLIC_WS_URL_PROD=wss://your-production-api.com

# Twilio Phone Numbers
NEXT_PUBLIC_TWILIO_PHONE_DEV=+1xxxxxxxxxx  # 表示用の番号

# 機能フラグ
NEXT_PUBLIC_ENABLE_MULTI_TENANT=false
```

### 5. ngrok のセットアップ（Twilio Webhook用）

Twilioからローカル環境にWebhookを受信するため、ngrokが必要です。

#### ngrok のインストール：
```bash
# macOS
brew install ngrok

# その他のOS
# https://ngrok.com/download からダウンロード
```

#### ngrok の起動：
```bash
ngrok http 5001
```

表示されたHTTPS URLを `backend/.env` の `NGROK_URL` と `WEBHOOK_BASE_URL_DEV` に設定します。

例：
```
NGROK_URL=https://abc123.ngrok-free.app
WEBHOOK_BASE_URL_DEV=https://abc123.ngrok-free.app
```

### 6. Twilioの設定

1. [Twilio Console](https://console.twilio.com)にログイン
2. Phone Numbers > Manage > Active Numbers から使用する番号を選択
3. Voice Configuration セクションで：
   - "A call comes in" のWebhook URLを設定：
     ```
     https://your-ngrok-url.ngrok-free.app/api/twilio/voice
     ```
   - HTTP メソッドを `POST` に設定
4. 保存

### 7. データベースの初期設定

```bash
cd backend

# デフォルト企業の作成（マルチテナント機能を使用しない場合）
node scripts/createDefaultCompany.js

# 管理者アカウントの作成（オプション）
node setup-agent.js
```

### 8. アプリケーションの起動

#### バックエンドサーバーの起動：
```bash
cd backend
npm run dev
```

#### フロントエンドの起動：
```bash
cd frontend
npm run dev
```

### 9. アクセス

- フロントエンド: http://localhost:3000
- バックエンドAPI: http://localhost:5001
- 管理画面: http://localhost:3000/admin

## 初回ユーザー登録

1. http://localhost:3000/signup にアクセス
2. ユーザー情報を入力して登録
3. ログイン後、ダッシュボードから各機能にアクセス可能

## 主要な機能の使い方

### 顧客データのインポート
1. ダッシュボードから「顧客管理」を選択
2. CSVファイルで顧客データを一括インポート
3. サンプルCSVファイル: `sample_customers_single.csv`, `sample_customers_multiple.csv`

### 電話発信
1. 顧客リストから発信対象を選択
2. 「発信」ボタンをクリック
3. リアルタイムで通話状況をモニタリング

### オペレーターハンドオフ
1. 通話モニター画面で進行中の通話を確認
2. 必要に応じて「ハンドオフ」ボタンをクリック
3. オペレーターが通話に参加

## トラブルシューティング

### MongoDBに接続できない場合
```bash
# MongoDBの状態を確認
brew services list | grep mongodb

# 再起動
brew services restart mongodb-community
```

### Twilioのwebhookが受信できない場合
- ngrokが起動していることを確認
- ngrok URLが正しく設定されていることを確認
- Twilioコンソールでwebhook URLが正しく設定されていることを確認

### ポートが使用中の場合
```bash
# 使用中のポートを確認
lsof -i :5001  # バックエンド
lsof -i :3000  # フロントエンド

# プロセスを終了
kill -9 <PID>
```

## 開発コマンド

### バックエンド
```bash
npm run dev    # 開発サーバー起動（自動リロード）
npm start      # 本番サーバー起動
```

### フロントエンド
```bash
npm run dev    # 開発サーバー起動
npm run build  # 本番ビルド
npm run start  # 本番サーバー起動
npm run lint   # Lintチェック
```

## API ドキュメント

主要なAPIエンドポイント：

- `POST /api/auth/signup` - ユーザー登録
- `POST /api/auth/login` - ログイン
- `GET /api/customers` - 顧客リスト取得
- `POST /api/calls` - 電話発信
- `GET /api/calls/active` - アクティブな通話取得
- `POST /api/handoff/initiate` - ハンドオフ開始

## ライセンス

[ライセンス情報を記載]

## サポート

問題が発生した場合は、GitHubのIssuesで報告してください。
