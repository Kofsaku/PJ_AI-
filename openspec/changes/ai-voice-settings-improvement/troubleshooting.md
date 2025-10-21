# Troubleshooting Guide: AI Voice Settings Implementation

## Overview
このドキュメントは、AI設定機能実装時に遭遇した問題と解決策をまとめたトラブルシューティングガイドです。

## Issue 1: AI設定が保存されない（Critical）

### 症状
- UIで設定を変更し「保存」ボタンをクリック
- 成功メッセージは表示される
- しかし、ページをリロードすると設定が元に戻る
- データベースを直接確認しても値が更新されていない

### 発生条件
- ローカル開発環境（localhost:3000とlocalhost:5000）
- フロントエンドとバックエンドを別々のポートで起動している場合

### 調査ステップ

#### Step 1: フロントエンドのリクエストを確認
```javascript
// ブラウザのDevTools > Networkタブで確認
// リクエストペイロードは正しい
{
  "voice": "alloy",
  "conversationSettings": {
    "conversationStyle": "formal",
    "speechRate": "fast"
  }
}
```
✅ データは正しく送信されている

#### Step 2: バックエンドのログを確認
```bash
# バックエンドコンソールを確認
# 期待されるログ: [Sales Pitch Update] Updating settings for user...
# 実際: ログが全く出力されない
```
❌ バックエンドにリクエストが届いていない

#### Step 3: フロントエンドAPIプロキシを確認
```typescript
// frontend/app/api/users/sales-pitch/route.ts
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL_PROD || process.env.NEXT_PUBLIC_BACKEND_URL

console.log('Backend URL:', BACKEND_URL); // 確認用ログ追加
```

**判明した問題**:
- `BACKEND_URL`が`https://pj-ai.onrender.com`（本番環境）になっていた
- ローカルバックエンド（`http://localhost:5000`）に接続すべきところ、本番に接続していた

### 根本原因

Next.js API Routesの環境変数の優先順位が間違っていた:

```typescript
// ❌ 間違い（本番URLを優先）
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL_PROD || process.env.NEXT_PUBLIC_BACKEND_URL || 'https://pj-ai.onrender.com'

// ✅ 正しい（ローカルURLを優先）
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL_PROD || 'http://localhost:5000'
```

### 解決策

1. **環境変数の優先順位を修正**
   ```typescript
   // frontend/app/api/users/sales-pitch/route.ts
   const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL_PROD || 'http://localhost:5000'
   ```

2. **.envファイルを確認**
   ```bash
   # frontend/.env.local
   NEXT_PUBLIC_BACKEND_URL=http://localhost:5000
   NEXT_PUBLIC_BACKEND_URL_PROD=https://pj-ai.onrender.com
   ```

3. **デバッグログを追加（一時的）**
   ```typescript
   console.log('[API Proxy] Backend URL:', BACKEND_URL);
   console.log('[API Proxy] Request to:', `${BACKEND_URL}/api/users/sales-pitch`);
   ```

### 検証方法

```bash
# 1. バックエンドを起動
cd backend && npm start

# 2. フロントエンドを起動
cd frontend && npm run dev

# 3. ブラウザのDevToolsでNetwork監視
# - リクエストURL: http://localhost:3000/api/users/sales-pitch
# - 実際の接続先: http://localhost:5000/api/users/sales-pitch
# - ステータス: 200 OK
# - レスポンス: { success: true, data: {...} }

# 4. バックエンドコンソールでログ確認
# [Sales Pitch Update] Updating settings for user: 68a070f04f58e8af1812b113
# [Sales Pitch Update] AI Settings - voice: alloy, conversationStyle: formal, speechRate: fast
```

### 予防策

1. **環境変数の命名規則を統一**
   - ローカル: `NEXT_PUBLIC_BACKEND_URL`（短い名前を優先）
   - 本番: `NEXT_PUBLIC_BACKEND_URL_PROD`（`_PROD`サフィックス）

2. **開発環境チェックスクリプトを作成**
   ```javascript
   // scripts/check-env.js
   const requiredEnvVars = [
     'NEXT_PUBLIC_BACKEND_URL',
     'MONGODB_URI'
   ];

   requiredEnvVars.forEach(key => {
     if (!process.env[key]) {
       console.error(`❌ Missing required env var: ${key}`);
       process.exit(1);
     }
     console.log(`✅ ${key}: ${process.env[key]}`);
   });
   ```

3. **API接続テストを追加**
   ```typescript
   // frontend/lib/api-health.ts
   export async function checkBackendHealth() {
     const response = await fetch('/api/health');
     if (!response.ok) {
       console.error('Backend health check failed');
     }
   }
   ```

---

## Issue 2: Mongooseでネストオブジェクトが更新されない

### 症状
- トップレベルフィールド（`voice`）は正しく保存される
- ネストされたフィールド（`conversationSettings.conversationStyle`）は保存されない
- `await agentSettings.save()`を実行してもDBに反映されない

### 調査ステップ

```javascript
// backend/routes/userRoutes.js
// 更新前
agentSettings.conversationSettings.conversationStyle = 'formal';
agentSettings.conversationSettings.speechRate = 'fast';
await agentSettings.save();

// DBを確認
// conversationStyle と speechRate が更新されていない！
```

### 根本原因

**Mongooseの変更検知の仕組み**:
- Mongooseはドキュメントのトップレベルフィールドの変更のみ自動検知
- ネストオブジェクトのプロパティ変更は検知されない
- これはパフォーマンス最適化のため

**詳細**:
```javascript
// ✅ これは検知される
agentSettings.voice = 'alloy';

// ❌ これは検知されない
agentSettings.conversationSettings.conversationStyle = 'formal';
```

### 解決策

#### 方法1: markModified()を使用（推奨）
```javascript
agentSettings.conversationSettings.conversationStyle = 'formal';
agentSettings.conversationSettings.speechRate = 'fast';
agentSettings.markModified('conversationSettings'); // 重要！
await agentSettings.save();
```

#### 方法2: 新しいオブジェクトを代入
```javascript
agentSettings.conversationSettings = {
  ...agentSettings.conversationSettings,
  conversationStyle: 'formal',
  speechRate: 'fast'
};
await agentSettings.save();
```

#### 方法3: set()メソッドを使用
```javascript
agentSettings.set('conversationSettings.conversationStyle', 'formal');
agentSettings.set('conversationSettings.speechRate', 'fast');
await agentSettings.save();
```

### 実装例

```javascript
// backend/routes/userRoutes.js
router.put('/api/users/sales-pitch', authenticate, async (req, res) => {
  try {
    const { voice, conversationSettings } = req.body;
    const agentSettings = await AgentSettings.findOne({ userId: req.user.userId });

    // フラグで変更を追跡
    let conversationSettingsModified = false;

    // ネストフィールドの更新
    if (conversationSettings) {
      if (conversationSettings.conversationStyle !== undefined) {
        agentSettings.conversationSettings.conversationStyle = conversationSettings.conversationStyle;
        conversationSettingsModified = true;
      }
      if (conversationSettings.speechRate !== undefined) {
        agentSettings.conversationSettings.speechRate = conversationSettings.speechRate;
        conversationSettingsModified = true;
      }
    }

    // ネストフィールドが変更された場合のみmarkModified
    if (conversationSettingsModified) {
      agentSettings.markModified('conversationSettings');
      console.log('[Debug] Marked conversationSettings as modified');
    }

    // トップレベルフィールドの更新（自動検知される）
    if (voice !== undefined) {
      agentSettings.voice = voice;
    }

    await agentSettings.save();
    console.log('[Debug] Settings saved successfully');

    res.json({ success: true, data: agentSettings });
  } catch (error) {
    console.error('[Error]', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});
```

### 検証方法

```bash
# MongoDBで直接確認
mongosh "mongodb+srv://..."

use ai-call
db.agentsettings.findOne({ userId: ObjectId("68a070f04f58e8af1812b113") })

# conversationSettings.conversationStyle と speechRate が更新されていることを確認
```

### 予防策

1. **スキーマ設計時の検討**
   - 頻繁に更新されるフィールドはトップレベルに配置
   - ネストオブジェクトは関連するデータをグループ化する目的のみ

2. **更新ロジックのパターン化**
   ```javascript
   // ヘルパー関数を作成
   function updateNestedField(doc, path, value) {
     doc.set(path, value);
     const topLevel = path.split('.')[0];
     doc.markModified(topLevel);
   }
   ```

3. **テストの追加**
   ```javascript
   // tests/agent-settings.test.js
   it('should update nested conversationSettings fields', async () => {
     const settings = await AgentSettings.findOne({ userId });
     settings.conversationSettings.speechRate = 'fast';
     settings.markModified('conversationSettings');
     await settings.save();

     const updated = await AgentSettings.findOne({ userId });
     expect(updated.conversationSettings.speechRate).toBe('fast');
   });
   ```

---

## Issue 3: voiceフィールドがレスポンスに含まれない

### 症状
- PUT /api/users/sales-pitchのレスポンスに`voice`フィールドがない
- フロントエンドが保存後の値を正しく読み込めない

### 根本原因

レスポンスのdata構造が`conversationSettings`のみを返していた:

```javascript
// ❌ 修正前
res.json({
  success: true,
  message: 'トークスクリプト設定が更新されました',
  data: {
    conversationSettings: agentSettings.conversationSettings
  }
});
```

### 解決策

```javascript
// ✅ 修正後
res.json({
  success: true,
  message: 'トークスクリプト設定が更新されました',
  data: {
    voice: agentSettings.voice, // 追加
    conversationSettings: agentSettings.conversationSettings
  }
});
```

---

## 一般的なデバッグ手法

### 1. ログの追加
```javascript
console.log('[Debug Point] Variable:', JSON.stringify(variable, null, 2));
```

### 2. リクエスト/レスポンスの完全なログ
```javascript
console.log('[Request]', {
  method: req.method,
  url: req.url,
  body: req.body,
  headers: req.headers
});

console.log('[Response]', {
  status: res.statusCode,
  body: responseData
});
```

### 3. データベースの直接確認
```bash
# MongoDBで確認
mongosh "mongodb+srv://..."
use ai-call
db.agentsettings.find().pretty()
```

### 4. ネットワークリクエストの監視
- ブラウザDevTools > Network
- リクエストURL、ステータスコード、ペイロード、レスポンスを確認

### 5. 環境変数の確認
```bash
# Node.jsアプリ内で確認
console.log('Environment:', {
  NODE_ENV: process.env.NODE_ENV,
  BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL,
  MONGODB_URI: process.env.MONGODB_URI?.substring(0, 30) + '...'
});
```

## 教訓とベストプラクティス

1. **環境変数の優先順位を明確に**
   - ローカル開発環境の変数を優先
   - フォールバックの順序を慎重に設計

2. **Mongooseの変更検知を理解する**
   - ネストオブジェクトは`markModified()`必須
   - 公式ドキュメントを読む

3. **レスポンス構造を統一**
   - すべてのAPI エンドポイントで一貫したレスポンス形式
   - TypeScriptの型定義でレスポンス構造を明確に

4. **デバッグログを戦略的に配置**
   - リクエスト受信時
   - データ更新前後
   - エラーハンドリング内

5. **段階的に検証**
   - フロントエンド → API Proxy → バックエンド → データベース
   - 各層で問題を切り分ける
