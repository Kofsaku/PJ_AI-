# マルチテナント・同時通話アーキテクチャ

## 概要

複数企業・複数担当者が同時に利用できるシステム設計。

## 1. 環境別設定

### 開発環境（ローカル）
- **電話番号**: +1 607 695 6082
- **Webhook URL**: ngrok経由 (https://xxxxx.ngrok-free.app)
- **環境変数**: NODE_ENV=development

### 本番環境
- **電話番号**: +1 417 922 4538  
- **Webhook URL**: Vercel (https://pj-ai-xxx.vercel.app)
- **環境変数**: NODE_ENV=production

## 2. 電話番号管理戦略

### オプション1: 共有プール方式（推奨・コスト効率的）
```
利点:
- 少ない電話番号で複数企業対応可能
- コスト効率が良い（Twilioの月額料金: $1.15/番号）
- 自動スケーリング可能

欠点:
- 発信者番号が企業ごとに異なる可能性
- 同時通話数が電話番号数に制限される
```

### オプション2: 企業専用番号方式
```
利点:
- 企業ごとに固定の発信者番号
- ブランディング効果

欠点:
- コストが高い（企業数 × $1.15/月）
- 管理が複雑
```

### オプション3: ハイブリッド方式
```
- エンタープライズ顧客: 専用番号
- スタンダード顧客: 共有プール
```

## 3. 同時通話処理

### Twilioの制限
- **1つの電話番号**: 同時に1つのアウトバウンドコールのみ
- **複数の同時通話**: 複数の電話番号が必要

### 実装アプローチ

#### PhonePoolモデル
```javascript
{
  phoneNumber: "+16076956082",
  status: "available" | "in_use" | "reserved",
  assignedTo: {
    companyId: ObjectId,
    userId: ObjectId,
    sessionId: String,
    assignedAt: Date
  },
  usageStats: {
    totalCalls: Number,
    totalMinutes: Number
  }
}
```

#### 番号割り当てロジック
1. 企業専用番号をチェック
2. 利用可能な共有番号を探す
3. 必要に応じて新規番号を購入（自動化可能）
4. 通話終了後に番号を解放

## 4. スケーリング戦略

### 自動スケーリング
```javascript
// 利用可能な番号が閾値以下になったら自動購入
if (availableNumbers < MIN_AVAILABLE_NUMBERS) {
  await phonePoolService.purchaseNewNumber();
}
```

### 負荷分散
- 複数の番号間で通話を分散
- 使用頻度の低い番号を優先的に割り当て

## 5. コスト最適化

### 料金構造（Twilio US）
- 電話番号: $1.15/月
- 発信通話: $0.013/分
- 着信通話: $0.0085/分

### 最適化戦略
1. **使用率モニタリング**: 番号の使用率を監視
2. **動的プロビジョニング**: ピーク時のみ番号を追加
3. **アイドル番号の解放**: 長期間未使用の番号を解放

## 6. 実装手順

### Step 1: 既存番号のインポート
```bash
node backend/scripts/import-phone-numbers.js
```

### Step 2: 環境変数の設定
```bash
# .env.local (開発)
NODE_ENV=development
TWILIO_PHONE_NUMBER_DEV=+16076956082
WEBHOOK_BASE_URL_DEV=https://xxxxx.ngrok-free.app

# .env.production (本番)
NODE_ENV=production  
TWILIO_PHONE_NUMBER_PROD=+14179224538
WEBHOOK_BASE_URL_PROD=https://pj-ai-xxx.vercel.app
```

### Step 3: Webhook更新
```bash
# 開発環境
NODE_ENV=development node backend/scripts/update-twilio-webhooks.js

# 本番環境
NODE_ENV=production node backend/scripts/update-twilio-webhooks.js
```

## 7. 管理画面機能

### 電話番号プール管理
- 番号の追加/削除
- 使用状況モニタリング
- コスト分析

### 企業管理
- 企業ごとの通話履歴
- 専用番号の割り当て
- 使用制限の設定

## 8. セキュリティ考慮事項

- 企業間のデータ分離
- 通話録音のアクセス制御
- APIレート制限
- 監査ログ