# 技術スタックと依存関係

## フロントエンド技術スタック
### 基盤技術
- **Next.js 15.2.4**: React フレームワーク（App Router使用）
- **React 19**: UIライブラリ
- **TypeScript 5**: 型安全性
- **Tailwind CSS 3.4.17**: スタイリング

### UI コンポーネント
- **Radix UI**: アクセシブルなUIコンポーネント群
- **Lucide React**: アイコンライブラリ
- **Recharts**: チャート・グラフ表示
- **React Hook Form**: フォーム管理
- **Zod**: スキーマバリデーション

### 状態管理・通信
- **Socket.io Client**: リアルタイム通信
- **Axios**: HTTP クライアント
- **React Query (date-fns)**: データ取得・キャッシュ

### その他のフロントエンド依存関係
- **Next Themes**: ダークモード対応
- **Class Variance Authority**: 条件付きスタイリング
- **Tailwind Merge**: Tailwind クラス結合
- **Sonner**: トースト通知

## バックエンド技術スタック
### 基盤技術
- **Node.js 18+**: サーバーランタイム
- **Express 5.1.0**: Webフレームワーク
- **MongoDB + Mongoose 8.16.4**: データベース

### 認証・セキュリティ
- **JWT (jsonwebtoken 9.0.2)**: 認証トークン
- **bcrypt/bcryptjs**: パスワードハッシュ化
- **Helmet 8.1.0**: セキュリティヘッダー
- **CORS 2.8.5**: クロスオリジンリクエスト

### 外部API統合
- **Twilio 5.8.0**: 音声通話API
- **Socket.io 4.8.1**: リアルタイム通信

### ユーティリティ
- **dotenv 17.2.0**: 環境変数管理
- **Morgan 1.10.1**: ログ管理
- **Multer 2.0.2**: ファイルアップロード
- **CSV Parser 3.2.0**: CSVデータ処理

### 開発ツール
- **Nodemon 3.1.10**: 開発時の自動再起動

## プロジェクト設定ファイル
### フロントエンド設定
- `tsconfig.json`: TypeScript設定（strict mode有効）
- `tailwind.config.ts`: Tailwind CSS設定
- `next.config.mjs`: Next.js設定
- `components.json`: shadcn/ui設定

### バックエンド設定
- `nodemon.json`: Nodemon設定
- `.env.example`: 環境変数テンプレート

## パッケージ管理
- フロントエンド: npm（package-lock.json使用）
- バックエンド: npm（package-lock.json使用）
- 代替: pnpm対応（pnpm-lock.yaml存在）