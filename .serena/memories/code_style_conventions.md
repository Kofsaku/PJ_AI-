# コードスタイルと規約

## 全般的な規約
- **言語**: TypeScript（フロントエンド）、JavaScript（バックエンド）
- **コメント**: 日本語と英語の混在（日本語ドキュメントが主）
- **パス管理**: エイリアス使用（`@/*` → フロントエンドルート）

## フロントエンド規約
### TypeScript設定
- **Strict Mode**: 有効（`"strict": true`）
- **Target**: ES6
- **Module**: ESNext + bundler resolution
- **JSX**: preserve（Next.jsが処理）

### ファイル構造規約
- **App Router**: `app/` ディレクトリ使用
- **コンポーネント**: `components/` ディレクトリ
- **ユーティリティ**: `lib/` ディレクトリ
- **スタイリング**: Tailwind CSS + CSS-in-JS

### コンポーネント規約
- **関数コンポーネント**: アロー関数使用が主流
- **Props型定義**: インターフェースまたは型エイリアス
- **エクスポート**: 名前付きエクスポートとデフォルトエクスポートの使い分け

## バックエンド規約
### JavaScript設定
- **ES6+**: モダンJavaScript構文使用
- **CommonJS**: require/module.exports使用
- **非同期処理**: async/await パターン

### ファイル構造規約
- **MVC パターン**: Controllers, Models, Routes分離
- **サービス層**: `services/` でビジネスロジック分離
- **ミドルウェア**: `middlewares/` ディレクトリ
- **設定**: `config/` ディレクトリ

### 命名規約
- **ファイル**: kebab-case（例：`user-routes.js`）
- **関数**: camelCase
- **定数**: UPPER_SNAKE_CASE
- **クラス**: PascalCase

## 環境設定規約
### 環境変数
- **開発環境**: `.env`ファイル使用
- **本番環境**: 環境変数または設定ファイル
- **セキュリティ**: 機密情報は.env.exampleに含めない

### ポート設定
- **フロントエンド**: 3000（Next.js デフォルト）
- **バックエンド**: 5001
- **MongoDB**: 27017（デフォルト）

## 開発ツール設定
### Linting/Formatting
- **ESLint**: Next.js統合（`next lint`）
- **Prettier**: 明示的な設定ファイルなし（デフォルト設定使用）
- **TypeScript**: 型チェック有効

### Git規約
- **ブランチ**: main ブランチ使用
- **コミットメッセージ**: 日本語と英語混在
- **無視ファイル**: `.gitignore`で node_modules, .env, build成果物を除外

## 注意事項
- **セキュリティ**: 認証情報のハードコーディング禁止
- **パフォーマンス**: 大きなファイルの分割とレイジーロード推奨
- **国際化**: 日本語UI中心だが、多言語対応の考慮