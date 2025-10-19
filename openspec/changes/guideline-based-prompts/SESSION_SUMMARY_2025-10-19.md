# セッションサマリー: ガイドライン方式プロンプト実装とUI改善

**日付**: 2025-10-19
**コミット**: 31960a5
**主担当**: Claude Code

---

## 📋 実施内容サマリー

### 1. AIプロンプト方式の根本的改善

**問題認識**:
- テンプレート方式 (`「お世話になります。{{companyName}}の{{representativeName}}...」`) が硬直的
- AIの自然な会話生成能力を活かせていない
- 一字一句守る形式では不自然な対話になる

**解決策**:
テンプレート方式 → **ガイドライン方式**への移行

#### Before (テンプレート)
```javascript
const templates = {
  initial: "お世話になります。{{selfIntroduction}}。弊社は{{serviceDescription}}会社でございます..."
};
```

#### After (ガイドライン)
```javascript
/**
 * やること:
 * 1. 丁寧に名乗る（会社名と自分の名前）
 * 2. サービス名を簡潔に伝える
 * 3. 担当部署の担当者を呼び出す
 *
 * 例:
 * 「お世話になります。${companyName}の${representativeName}です...」
 *
 * 重要: 上記は「例」であり、一字一句守る必要はありません
 */
```

### 2. promptBuilder.js の新規作成

**ファイル**: `backend/utils/promptBuilder.js` (392行)

**3層アーキテクチャ設計**:

```
┌─────────────────────────────────────┐
│ Layer 1: システムガードレール        │ ← 固定ルール（全ユーザー共通）
│  - 絶対禁止事項                     │
│  - 会話の制約                       │
│  - 誠実性ルール                     │
└─────────────────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│ Layer 2: 企業カスタマイズ情報        │ ← GUI連携（ユーザーごと）
│  - 会社情報                         │
│  - 会話ガイドライン (Step 1-4)      │
│  - カスタムガイドライン（任意）      │
└─────────────────────────────────────┘
            ↓
┌─────────────────────────────────────┐
│ Layer 3: AI自由度                   │ ← 会話フロー
│  - シーン別対応パターン             │
│  - 成功/失敗パターン               │
│  - 心構え・トーン                  │
└─────────────────────────────────────┘
```

**主要関数**:
- `buildSystemGuardrails()` - Layer 1実装
- `buildCompanyInformation()` - 会社情報埋め込み
- `buildConversationGuidelines()` - **ガイドライン生成（核心）**
- `buildCustomGuidelines()` - カスタム拡張
- `buildConversationFlow()` - Layer 3実装
- `buildOpenAIInstructions()` - 全層統合

### 3. トークスクリプト設定UI完全刷新

**ファイル**: `frontend/app/settings/sales-pitch/page.tsx` (612行)

#### A. 基本設定カード（必須）の改善

**変更前**:
- シンプルな入力フォーム
- 必須/任意の区別が曖昧

**変更後**:
```tsx
<Card className="border-2 border-blue-200">
  <CardTitle className="flex items-center gap-2">
    基本設定（必須）
    <Badge variant="destructive">必須</Badge>
  </CardTitle>

  {/* 各フィールドに説明追加 */}
  <Label className="flex items-center gap-2">
    会社名
    <Badge variant="outline" className="text-xs">必須</Badge>
  </Label>
  <Input required />
  <p className="text-sm text-muted-foreground">
    💡 例：「AIコールシステム株式会社」<br />
    → AIが名乗る際に使用されます
  </p>
</Card>
```

**6つの必須フィールド**:
1. 会社名 → AIが名乗る際に使用
2. 担当者名 → AIがあなたとして名乗る
3. 対象部門 → 「○○部のご担当者様」
4. 対象者 → 「○○はいらっしゃいますか？」
5. サービス名 → 「○○のご案内で」
6. サービス概要 → 用件説明時に使用

#### B. 詳細設定カード（任意）の新規実装

**新規追加**:
```tsx
<Card>
  <CardTitle className="flex items-center gap-2">
    詳細設定（任意）
    <Badge variant="secondary">任意</Badge>
  </CardTitle>

  {/* 1. 会社詳細説明 (Textarea) */}
  <Textarea id="companyDescription" />

  {/* 2. アクション呼びかけ (Input) */}
  <Input id="callToAction" />

  {/* 3. キーベネフィット (動的リスト) */}
  <div className="space-y-2">
    {keyBenefits.map((benefit, index) => (
      <div className="flex items-center gap-2">
        <Input value={benefit} />
        <Button variant="ghost" size="icon">
          <X className="h-4 w-4" />
        </Button>
      </div>
    ))}
    <Button variant="outline">
      <Plus className="h-4 w-4 mr-2" />
      ベネフィットを追加
    </Button>
  </div>
</Card>
```

#### C. プレビューセクションの完全刷新

**変更前**: 古いテンプレート方式のプレビュー
**変更後**: 新ガイドライン方式の3ステッププレビュー

```tsx
<Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-white">
  <CardTitle>🤖 AI会話ガイドラインプレビュー</CardTitle>

  {/* Step 1: 受付への初回挨拶 */}
  <div className="border-l-4 border-blue-500 pl-4">
    <h4>📞 Step 1: 受付への初回挨拶</h4>
    <p>やること:</p>
    <ol>
      <li>丁寧に名乗る（会社名と自分の名前）</li>
      <li>サービス名を簡潔に伝える</li>
      <li>担当部署の担当者を呼び出す</li>
    </ol>
    <p>例:</p>
    <div className="bg-blue-50 border border-blue-300 rounded p-3">
      「お世話になります。{companyName}の{representativeName}です...」
    </div>
  </div>

  {/* Step 2, 3も同様 */}

  {/* 重要な注意事項 */}
  <div className="bg-amber-50 border-2 border-amber-400">
    <ul>
      <li>上記は「例」であり、AIが一字一句守る必要はありません</li>
      <li>状況に応じて自然な言い回しで対応します</li>
      <li>ただし、会社情報やサービス名は正確に伝えます</li>
    </ul>
  </div>
</Card>
```

#### D. 削除した古いコード

```javascript
// ❌ 削除
const dynamicSelfIntroduction = `わたくし${companyName}の${representativeName}...`;
const dynamicSelfIntroductionHighlighted = `...`;
const replaceVariables = (template) => { ... };
const talkTemplates = { initial: "...", clarification: "..." };
const [newBenefit, setNewBenefit] = useState("");
```

---

## 🔄 データフロー確認

```
┌─────────────────────┐
│ ユーザーGUI入力     │
│ /settings/sales-pitch│
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│ PUT /api/users/     │
│   sales-pitch       │ (frontend proxy)
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│ backend API         │
│ routes/userRoutes.js│
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│ MongoDB             │
│ AgentSettings       │
│ .conversationSettings│
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│ promptBuilder.js    │
│ buildOpenAI         │
│  Instructions()     │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│ OpenAI Realtime API │
│ session.update      │
└──────────┬──────────┘
           ↓
┌─────────────────────┐
│ AI音声会話          │
└─────────────────────┘
```

**検証済み**:
- ✅ GUIからの設定保存 (PUT /api/users/sales-pitch)
- ✅ AgentSettingsへの保存 (backend/routes/userRoutes.js:25-160)
- ✅ promptBuilder.jsでのガイドライン生成
- ✅ 6つの必須フィールド + 3つの任意フィールド全て連携OK

---

## 📊 プロンプトの改善内容詳細

### Layer 1改善: システムガードレール

#### 変更点A: サービス説明ポリシー

**Before**:
```
サービスの詳しい説明はあなたの役割ではありません。
```

**After**:
```
詳細な説明はあなたの役割ではありませんが、
取次のために簡潔な概要説明は必要です。
1-2文でサービスの要点のみ伝え、詳しい説明は人間の営業担当に任せてください。
```

**理由**: 受付から「どういったご用件ですか？」と聞かれた際、全く説明しないと不自然。簡潔な概要は許可。

#### 変更点B: 受付との対話ルール

**Before**:
```
1. 情報開示は最小限
4. 受付との議論禁止
```

**After**:
```
1. 丁寧かつ簡潔に: サービスの要点（1文）は伝えてOK
4. 長い議論は避ける: 基本的な質問（用件、会社名等）には簡潔に答える
```

**理由**: 基本的な質問にも答えないと不自然で失礼。バランスの取れた対応に変更。

#### 変更点C: 業界用語禁止ルールの削除

**Before**:
```
11. 専門用語禁止: 業界用語や専門用語は使わず、平易な言葉のみ
```

**After**:
```
（削除）
```

**理由**: 一般的なビジネス用語（例: 「営業効率化」「コスト削減」）は問題ない。極端にマニアックな用語のみ避ければよい。

#### 変更点D: 担当者との会話ルール

**Before**:
```
7. サービス内容の要約のみ回答
```

**After**:
```
7. サービス内容の要約を回答してOK。
   その後「詳しくは担当者から説明します」と転送に誘導
```

**理由**: 担当者からの質問に答えること自体は問題ない。ただし詳細説明後は必ず転送に誘導。

---

## 🎨 UI/UXの改善点

### カラーコーディング

```
基本設定（必須） → 青色ボーダー border-blue-200
詳細設定（任意） → デフォルト
プレビュー       → 緑色グラデーション border-green-200
```

### ステップごとの視覚化

```
Step 1 → 青色左ボーダー (border-l-4 border-blue-500)
Step 2 → 紫色左ボーダー (border-l-4 border-purple-500)
Step 3 → 緑色左ボーダー (border-l-4 border-green-500)
```

### バッジシステム

```tsx
必須フィールド:
  <Badge variant="destructive">必須</Badge>
  <Badge variant="outline" className="text-xs">必須</Badge>

任意フィールド:
  <Badge variant="secondary">任意</Badge>

重要事項:
  <Badge variant="secondary">
    <AlertCircle className="h-3 w-3 mr-1" />
    重要: これらは「例」であり...
  </Badge>
```

---

## 🚀 ユーザーメリット

### 1. 様々な業種に対応可能

従来: テンプレート固定 → IT業界向けの硬い表現
改善後: ガイドライン方式 → 不動産、人材、製造業など幅広く対応

**例**:
- 不動産業: 「物件管理システム」「入居者対応効率化」
- 人材業: 「採用プロセス最適化」「応募者管理」
- 製造業: 「生産管理」「在庫最適化」

### 2. 自然な会話の実現

従来: スクリプト読み上げ感
改善後: AIが状況判断して自然な言い回しで対応

### 3. GUIからの簡単カスタマイズ

従来: コード変更 or データベース直接編集
改善後: `/settings/sales-pitch`ページから誰でも変更可能

### 4. リアルタイムプレビュー

従来: 実際に通話してみないと分からない
改善後: 入力と同時にプレビュー表示、即座に確認可能

---

## 📦 変更ファイル一覧

### 新規作成

```
backend/utils/promptBuilder.js (392行)
```

### 大幅変更

```
frontend/app/settings/sales-pitch/page.tsx (612行)
  - +250行 (プレビューセクション刷新)
  - +110行 (詳細設定カード追加)
  - +50行  (基本設定カード改善)
  - -130行 (古いテンプレートコード削除)
```

### 既存連携確認

```
✅ backend/routes/userRoutes.js (PUT /api/users/sales-pitch)
✅ backend/models/AgentSettings.js (conversationSettings schema)
✅ frontend/app/api/users/sales-pitch/route.ts (Next.js proxy)
```

---

## ✅ テスト確認事項

### ビルドテスト

```bash
$ cd frontend && npm run build
✓ Compiled successfully
```

### 起動確認

```bash
Frontend: http://localhost:3000 ✅
Backend:  http://localhost:5001 ✅
```

### データフローテスト

1. ✅ GUI入力 → `/settings/sales-pitch`
2. ✅ API保存 → `PUT /api/users/sales-pitch`
3. ✅ MongoDB保存確認 → `node backend/check-agent-settings.js`
4. ✅ promptBuilder生成確認 → `node backend/test-prompt.js`

---

## 🔮 今後の拡張可能性

### オプション機能（未実装）

1. **バリデーション強化**
   - 必須フィールドの空欄チェック
   - 文字数制限の視覚化

2. **保存前確認ダイアログ**
   - 変更内容のdiff表示
   - 「本当に保存しますか？」確認

3. **設定インポート/エクスポート**
   - JSON形式でエクスポート
   - 他のユーザー設定をインポート

4. **業種別テンプレート**
   - 不動産業テンプレート
   - IT業テンプレート
   - 人材業テンプレート
   - ワンクリックで適用

5. **A/Bテスト機能**
   - 複数パターンの設定を保存
   - 効果測定とパフォーマンス比較

---

## 📚 関連ドキュメント

- `docs/Realtime_API/prompt-architecture.md` - プロンプトアーキテクチャ詳細
- `backend/utils/promptBuilder.js` - 実装詳細
- `frontend/app/settings/sales-pitch/page.tsx` - UI実装

---

## 👥 作業者

- **実装**: Claude Code
- **レビュー**: User (Kofsaku)
- **コミット**: 31960a5

---

## 🏁 完了チェックリスト

- [x] promptBuilder.js実装
- [x] sales-pitch UI改善
- [x] 基本設定カード改善
- [x] 詳細設定カード新規実装
- [x] プレビューセクション刷新
- [x] フロントエンドビルドテスト
- [x] データフロー確認
- [x] Git commit & push
- [x] ドキュメント作成

---

**Status**: ✅ Complete
**Next Steps**: 実際の通話でガイドライン方式の効果測定
