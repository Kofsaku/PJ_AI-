# タスク完了時のガイドライン

## 必須チェック項目

### 1. コード品質チェック
```bash
# フロントエンドのLintチェック
cd frontend && npm run lint

# TypeScript型チェック（フロントエンド）
cd frontend && npx tsc --noEmit

# ビルドエラーチェック
cd frontend && npm run build
```

### 2. 設定確認
```bash
# システム設定確認
npm run check-config

# ngrok URL更新確認
node scripts/check-startup-config.js
```

### 3. 機能テスト
```bash
# Twilio接続テスト
node backend/test-twilio-direct.js

# Coefont API テスト（音声合成）
node backend/test-coefont.js

# データベース接続確認
node backend/check-users.js
```

## 開発環境でのチェック

### サーバー起動確認
1. **バックエンド**: http://localhost:5001 でAPI応答確認
2. **フロントエンド**: http://localhost:3000 でUI表示確認
3. **ngrok**: Webhook URLが有効か確認

### リアルタイム機能確認
1. **Socket.io接続**: WebSocket通信が正常か確認
2. **通話機能**: Twilio経由の音声通話テスト
3. **ハンドオフ機能**: オペレーター連携テスト

## コード変更後の確認事項

### バックエンド変更時
- [ ] API エンドポイントが正常に動作するか
- [ ] データベース操作にエラーがないか
- [ ] 認証・認可が適切に機能するか
- [ ] Webhook処理が正常か

### フロントエンド変更時
- [ ] UI コンポーネントが正常に表示されるか
- [ ] API通信が正常に行われるか
- [ ] 状態管理が適切に機能するか
- [ ] レスポンシブデザインが保たれているか

### 設定ファイル変更時
- [ ] 環境変数が正しく読み込まれるか
- [ ] 外部サービスとの連携が正常か
- [ ] セキュリティ設定が適切か

## エラー時の対処手順

### 1. ログ確認
```bash
# バックエンドログ
cd backend && npm run dev  # ログ出力を確認

# フロントエンドログ
cd frontend && npm run dev  # ブラウザコンソール確認
```

### 2. 依存関係確認
```bash
# パッケージ再インストール
npm run install-all

# キャッシュクリア
cd frontend && rm -rf .next
cd backend && rm -rf node_modules/.cache
```

### 3. 設定リセット
```bash
# 環境変数再設定
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local

# データベース初期化
node backend/scripts/createDefaultCompany.js
```

## デプロイ前チェックリスト

### セキュリティ
- [ ] 機密情報がコードに含まれていないか
- [ ] 環境変数が適切に設定されているか
- [ ] CORS設定が適切か
- [ ] 認証機能が正常に動作するか

### パフォーマンス
- [ ] ビルドサイズが適切か
- [ ] 不要なライブラリが含まれていないか
- [ ] 画像・音声ファイルが最適化されているか

### 互換性
- [ ] 対象ブラウザで動作するか
- [ ] モバイル端末で正常に表示されるか
- [ ] 異なる画面サイズで適切に動作するか

## 品質保証のための推奨事項

1. **段階的テスト**: 小さな変更から大きな変更へと段階的にテスト
2. **ユーザーシナリオテスト**: 実際の利用シーンを想定したテスト
3. **エラーハンドリング**: 異常系の動作確認
4. **パフォーマンス測定**: レスポンス時間や負荷テスト
5. **ドキュメント更新**: 変更内容に応じてドキュメント更新