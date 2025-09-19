# AI Call System - デプロイ戦略ガイド

## 📋 現在の問題

### Vercelでのフルスタックデプロイ課題

#### 🚨 主な問題点
1. **フロントエンドのみデプロイ**: バックエンド（Express.js）が含まれない
2. **API Route 404エラー**: `/api/customers/[id]` などが動作しない
3. **WebSocket制限**: リアルタイム通話監視機能が困難
4. **実行時間制限**: 60秒でタイムアウト（長時間通話に不適）
5. **Express.js変換必要**: 既存コードを大幅に書き換える必要

#### 🔍 現在の構造
```
ローカル環境:
├── frontend/ (localhost:3000) ✅
├── backend/  (localhost:5001) ✅
└── MongoDB   (Atlas)          ✅

Vercelデプロイ:
├── frontend/ (Vercel)         ✅
├── backend/  (存在しない)      ❌
└── MongoDB   (Atlas)          ✅
```

#### 📊 影響範囲
- **顧客ステータス更新**: 404エラー
- **一括コール機能**: 動作不可
- **リアルタイム通話監視**: WebSocket不可
- **音声処理**: CoeFont API連携困難

---

## 🚀 推奨デプロイサービス

### 1. Railway (最推奨)
**✅ メリット**:
- フロントエンド + バックエンド同時デプロイ
- WebSocket完全対応
- 現在のプロジェクト構造をそのまま使用可能
- 設定ファイル1つ追加するだけ
- GitHub連携自動デプロイ

**💰 料金**: 月$5〜
**⚡ 設定時間**: 約5分

**設定例**:
```json
// railway.json
{
  "version": 2,
  "builds": [
    {
      "src": "frontend/package.json",
      "use": "@vercel/node"
    },
    {
      "src": "backend/package.json",
      "use": "@vercel/node"
    }
  ]
}
```

### 2. Render
**✅ メリット**:
- 無料プラン有り
- フルスタック対応
- 簡単な設定

**💰 料金**: 無料〜月$7
**⚡ 設定時間**: 約10分

### 3. DigitalOcean App Platform
**✅ メリット**:
- エンタープライズ級
- 高いスケーラビリティ
- 豊富な機能

**💰 料金**: 月$5〜
**⚡ 設定時間**: 約15分

### 4. Heroku
**✅ メリット**:
- 老舗で安定
- 豊富なアドオン

**❌ デメリット**:
- 料金が高め
- 無料プラン廃止

**💰 料金**: 月$7〜

---

## 📊 サービス比較

| サービス | フロントエンド | バックエンド | WebSocket | 料金/月 | 設定の簡単さ | 推奨度 |
|---------|---------------|-------------|-----------|---------|-------------|--------|
| **Railway** | ✅ | ✅ | ✅ | $5〜 | ⭐⭐⭐⭐⭐ | 🥇 |
| **Render** | ✅ | ✅ | ✅ | 無料〜$7 | ⭐⭐⭐⭐ | 🥈 |
| **DigitalOcean** | ✅ | ✅ | ✅ | $5〜 | ⭐⭐⭐ | 🥉 |
| **Vercel単体** | ✅ | ❌ | ❌ | 無料 | ⭐⭐ | ❌ |
| **Vercel + 別途** | ✅ | ✅ | ⚠️ | $5〜20 | ⭐⭐ | ⚠️ |

---

## 🎯 推奨移行戦略

### フェーズ1: 緊急対応（現在）
**目的**: ステータス更新機能の復旧
**方法**: Next.js API RouteでMongoDB直接接続
**期間**: 即座
**影響**: 限定的（ステータス更新のみ）

### フェーズ2: 部分移行（短期）
**目的**: 主要API機能の復旧
**方法**: 重要なAPIをNext.js API Routeに移植
**期間**: 1週間
**影響**: 中程度（WebSocket以外）

### フェーズ3: 完全移行（中期）
**目的**: 全機能の安定動作
**方法**: Railwayへの完全移行
**期間**: 2週間
**影響**: 全機能

---

## 🔧 移行手順（Railway例）

### 1. プロジェクト準備
```bash
# ルートにrailway.json作成
{
  "deploy": {
    "startCommand": "npm run start-all",
    "buildCommand": "npm run build-all"
  }
}
```

### 2. package.json調整
```json
{
  "scripts": {
    "build-all": "cd frontend && npm install && npm run build && cd ../backend && npm install",
    "start-all": "concurrently \"cd backend && npm start\" \"cd frontend && npm start\""
  }
}
```

### 3. Railway設定
```bash
railway login
railway init
railway deploy
```

### 4. 環境変数設定
- MongoDB URI
- JWT Secret
- Twilio認証情報
- その他API キー

---

## ⚠️ 注意事項

### データベース
- MongoDB Atlasはそのまま使用可能
- 接続文字列の環境変数設定が必要

### ドメイン・SSL
- 各サービスで独自ドメインの設定可能
- SSL証明書は自動発行

### 監視・ログ
- 各サービスで基本的な監視機能を提供
- 本格運用時は外部監視サービス検討

---

## 📞 サポート・相談

技術的な移行サポートが必要な場合は、各サービスのドキュメントを参照するか、開発チームにご相談ください。

**更新日**: 2024年9月17日
**作成者**: Claude Code Assistant