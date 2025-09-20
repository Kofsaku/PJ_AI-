# API データ構造不一致問題 分析レポート

## 概要
フロントエンドからAPIへのリクエスト/レスポンスで、データ構造の不一致により保存や表示が正常に動作しない問題が頻発している。
本ドキュメントは全APIエンドポイントを調査し、データ構造の不一致を特定・分類する。

## 既知の問題

### 1. sales-pitch API (修正済み)
**場所**: `/api/users/sales-pitch`
**問題**:
- フロントエンド送信: `settings` オブジェクト
- API期待値: `{ conversationSettings: { ... } }`
**修正状況**: ✅ 修正済み (ステージング済み)

### 2. call-history pagination API (修正済み)
**場所**: `/api/call-history`
**問題**:
- API返却値: `{ page, limit, total, totalPages }`
- フロントエンド期待値: `{ currentPage, totalPages, totalItems, itemsPerPage, hasNext, hasPrev }`
**修正状況**: ✅ 修正済み (デプロイ済み)

## 包括的調査結果

### 調査対象APIエンドポイント (35個)

1. `/api/calls/bulk/cancel/route.ts` - 一斉通話キャンセル
2. `/api/calls/bulk/route.ts` - 一斉通話開始・状態取得 ⚠️
3. `/api/calls/statistics/route.ts` - 通話統計
4. `/api/calls/[callId]/route.ts` - 個別通話操作
5. `/api/calls/active/route.ts` - アクティブ通話管理
6. `/api/auth/signup/route.ts` - ユーザー登録
7. `/api/auth/login/route.ts` - ログイン
8. `/api/auth/admin-login/route.ts` - 管理者ログイン
9. `/api/companies/route.ts` - 会社管理
10. `/api/companies/validate/[companyId]/route.ts` - 会社ID検証
11. `/api/companies/[id]/route.ts` - 個別会社操作
12. `/api/twilio/voice/operator/route.ts` - オペレーター接続
13. `/api/twilio/voice/response/route.ts` - 音声応答
14. `/api/twilio/voice/web-call/route.ts` - ウェブコール
15. `/api/twilio/voice/route.ts` - 音声通話
16. `/api/twilio/voice/connect/operator/route.ts` - オペレーター接続
17. `/api/twilio/voice/stream/route.ts` - 音声ストリーム
18. `/api/twilio/status/route.ts` - Twilio状態
19. `/api/twilio/token/route.ts` - Twilioトークン
20. `/api/twilio/call/status/route.ts` - 通話状態
21. `/api/twilio/call/route.ts` - Twilio通話
22. `/api/call-history/stats/summary/route.ts` - 履歴統計サマリー
23. `/api/call-history/route.ts` - 通話履歴 ✅ (修正済み)
24. `/api/call-history/[id]/route.ts` - 個別履歴
25. `/api/admin/users/phone-numbers/available/route.ts` - 利用可能電話番号
26. `/api/admin/users/route.ts` - 管理者ユーザー管理
27. `/api/admin/users/[id]/unassign-phone/route.ts` - 電話番号割り当て解除
28. `/api/admin/users/[id]/assign-phone/route.ts` - 電話番号割り当て
29. `/api/admin/users/[id]/route.ts` - 個別管理者ユーザー
30. `/api/users/sales-pitch/route.ts` - セールスピッチ設定 ✅ (修正済み)
31. `/api/websocket/route.ts` - WebSocket
32. `/api/test-debug/route.ts` - デバッグ
33. `/api/customers/import/route.ts` - 顧客インポート ⚠️
34. `/api/customers/route.ts` - 顧客管理 ⚠️

## データ構造不一致パターン分析

### パターン1: リクエストデータ構造の不一致

#### 1-1. sales-pitch API (修正済み)
**問題**: フロントエンド送信データとAPI期待値の不一致
- **フロントエンド**: `settings` オブジェクトをそのまま送信
- **API期待値**: `{ conversationSettings: { ... } }` 構造
- **修正済み**: フロントエンド側を修正してAPI構造に合わせた

#### 1-2. customers/import API ⚠️
**問題**: データ検証不足の可能性
- **フロントエンド送信**: `{ customers: formattedData }`
- **API処理**: 直接 `customers` 配列を受け取り
- **潜在的問題**: フィールド名や型の不一致時にエラー処理が不十分

### パターン2: レスポンスデータ構造の不一致

#### 2-1. call-history pagination (修正済み)
**問題**: pagination構造の不一致
- **API返却**: `{ page, limit, total, totalPages }`
- **フロントエンド期待**: `{ currentPage, totalPages, totalItems, itemsPerPage, hasNext, hasPrev }`
- **修正済み**: API側をフロントエンド期待値に統一

#### 2-2. bulk calls API ⚠️
**潜在的問題**: レスポンス構造の複雑性
- **API返却**:
  ```json
  {
    "success": true,
    "sessions": [{ "id": "...", "phoneNumber": "...", "status": "..." }],
    "sessionIds": ["..."]
  }
  ```
- **フロントエンド使用**: `result.results` を期待（存在しない）
- **問題箇所**: dashboard/page.tsx:434 `setCallResults(result.results || [])`

### パターン3: ID/識別子の不統一

#### 3-1. Customer IDの不一致
**問題**: IDフィールド名の不統一
- **MongoDB**: `_id` フィールド
- **フロントエンド期待**: `id` または `_id`
- **影響箇所**: dashboard/page.tsx:365-373で両方を考慮した処理

#### 3-2. データベースレスポンスとフロントエンド期待値
**問題**: MongoDB結果とフロントエンド表示の不一致
- **API返却**: MongoDBの生データ（`_id`, `createdAt`, etc.）
- **フロントエンド期待**: 加工済みデータ（`id`, `date`, `time`, etc.）

## 高優先度修正対象

### 🔴 緊急 (機能不全の原因)

1. **bulk calls API レスポンス構造**
   - 場所: `/api/calls/bulk/route.ts`
   - 問題: `result.results` が存在しないため処理失敗
   - 影響: 一斉通話機能が正常に動作しない

### 🟡 中優先度 (潜在的問題)

2. **customers/import データ検証**
   - 場所: `/api/customers/import/route.ts`
   - 問題: 不正データ時のハンドリングが不十分
   - 影響: CSVインポート時の予期しないエラー

3. **ID統一性**
   - 場所: 複数ファイル
   - 問題: `_id` vs `id` の不統一
   - 影響: 一部機能での識別子エラー

## 修正計画

### フェーズ1: 緊急修正
1. bulk calls APIのレスポンス構造修正
2. フロントエンドのbulk call結果処理修正

### フェーズ2: 構造統一
1. 全APIでID返却の統一（`_id` → `id` 変換）
2. レスポンス構造の標準化

### フェーズ3: 検証強化
1. 全APIのリクエスト検証強化
2. エラーハンドリングの統一

---

# バックエンドAPI調査結果

## バックエンドエンドポイント構造

### 主要ルート (server.js:85-102)
```
/api/auth         - authRoutes.js
/api/users        - userRoutes.js
/api/companies    - companyRoutes.js
/api/customers    - customers.js
/api/agents       - agentRoutes.js
/api/calls        - bulkCallRoutes.js, conferenceRoutes.js, callRoutes.js
/api/twilio       - twilioRoutes.js
/api/audio        - audioRoutes.js
/api/direct       - handoffDirectRoutes.js
/api/company-admin - companyAdminRoutes.js
/api/call-history - callHistoryRoutes.js
```

## フロントエンド vs バックエンド 不一致分析

### 🔴 緊急: bulk calls API構造不一致

#### フロントエンド (Next.js API) vs バックエンド (Express)

**1. bulk calls POST API**

**フロントエンド期待 (Next.js API)**:
```json
{
  "success": true,
  "sessions": [...],
  "sessionIds": [...],
  "results": [...] // ← これが存在しない
}
```

**バックエンド実際の返却値 (Express)**:
```json
{
  "message": "Queued X calls for sequential processing",
  "sessions": [
    {
      "id": "...",
      "phoneNumber": "...",
      "status": "queued"
    }
  ]
}
```

**問題**: フロントエンド dashboard/page.tsx:434で `result.results` を参照しているが、バックエンドは `results` フィールドを返していない。

### 🟡 中優先: customers import API

#### データ構造は一致しているが、処理ロジックに差異

**共通部分**:
- リクエスト: `{ customers: [...] }`
- レスポンス: `{ message: "...", count: number }`

**差異**:
- **フロントエンド (Next.js)**: MongoDB接続をAPI内で直接実行
- **バックエンド (Express)**: ルート → コントローラー構造で処理

### 🟡 中優先: レスポンス構造の統一性

#### フロントエンド vs バックエンドのレスポンス形式

**フロントエンド (Next.js API)**:
```json
{
  "success": true,
  "data": {...},
  "pagination": {...}
}
```

**バックエンド (Express)**:
```json
{
  "message": "...",
  "sessions": [...],
  // success フィールドなし
}
```

## 重複API実装の発見

### customers API の重複実装

1. **フロントエンド**: `frontend/app/api/customers/`
   - `import/route.ts` - 顧客インポート
   - `route.ts` - 顧客CRUD

2. **バックエンド**: `backend/routes/customers.js`
   - POST `/import` - 顧客インポート
   - GET/POST/PATCH/DELETE - 顧客CRUD

**問題**: 同じ機能が2箇所で実装されており、データ構造や処理ロジックに差異がある。

### calls API の重複実装

1. **フロントエンド**: `frontend/app/api/calls/bulk/route.ts`
2. **バックエンド**: `backend/routes/bulkCallRoutes.js` + `backend/controllers/bulkCallController.js`

## 修正優先度の更新

### 🔴 最高優先度

1. **bulk calls API構造統一**
   - バックエンドに `results` フィールド追加
   - または フロントエンドの `result.results` 参照を修正

2. **API実装の重複排除**
   - フロントエンドかバックエンドのどちらかに統一
   - 現在は両方が独立して動作している可能性

### 🟡 高優先度

3. **レスポンス構造の標準化**
   - 全APIで `{ success, data, error }` 形式に統一

4. **エラーハンドリングの統一**
   - フロントエンド・バックエンドで同一のエラー形式

## 推奨修正アプローチ

### 段階的統合戦略

1. **Phase 1**: 緊急修正
   - bulk calls APIの構造不一致を修正
   - 重複実装の動作確認と統一

2. **Phase 2**: アーキテクチャ統一
   - フロントエンド/バックエンドAPIの役割明確化
   - レスポンス構造の標準化

3. **Phase 3**: 長期的改善
   - TypeScript型定義の共有
   - APIスキーマ検証の導入