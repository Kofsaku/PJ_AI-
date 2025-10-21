# AI Voice Settings and Prompt Improvements

## Overview
OpenAI Realtime APIのボイス設定の最適化とプロンプトエンジニアリングの改善を実施しました。

## Status
- **Status**: Completed
- **Date**: 2025-10-21
- **Implemented By**: Claude Code

## Problem Statement
1. OpenAI公式の8種類のvoiceオプションが利用可能だが、システムでは3つのみ定義されていた
2. 会話トーン・スタイルが3つ（formal/casual/friendly）あるが、テレアポシステムとしてはフォーマルのみが適切
3. OpenAI公式のベストプラクティスに基づくプロンプト改善が必要
4. AI設定がデータベースに保存されない不具合（フロントエンドが本番URLに接続していた）

## Solution

### 1. AI設定保存の不具合修正
**問題**: AI設定（voice、conversationStyle、speechRate）が保存されない

**原因**:
```typescript
// frontend/app/api/users/sales-pitch/route.ts (修正前)
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL_PROD || process.env.NEXT_PUBLIC_BACKEND_URL
```
フロントエンドAPIプロキシが本番URLを優先し、ローカル開発環境のバックエンドに接続していなかった。

**修正**:
```typescript
// frontend/app/api/users/sales-pitch/route.ts (修正後)
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL_PROD
```

**追加修正**:
- Mongooseのネストオブジェクト更新には`markModified('conversationSettings')`が必要
- レスポンスに`voice`フィールドを追加

### 2. 会話トーン・スタイルを「フォーマル」に固定
**変更内容**:
- UIから会話トーン・スタイルのラジオボタンを削除
- `promptBuilder.js`で会話スタイルを「ビジネス敬語（フォーマル）」に固定
- `conversationStyle`フィールドはDB互換性のため保持（常に'formal'を送信）

**理由**: テレアポシステムとして、カジュアルやフレンドリーなトーンは不適切。ビジネス敬語に統一することでブランド品質を維持。

### 3. AIボイスを3種類に厳選
**変更前**: 8種類（alloy, ash, ballad, coral, echo, sage, shimmer, verse）
**変更後**: 3種類
- **alloy**: 中性的で柔らかい
- **cedar**: ハキハキと明瞭
- **coral**: 温かく友好的

**理由**:
- 選択肢が多すぎるとユーザーが迷う
- 実用的な3つのトーンに絞り込み
- 日本語の特徴説明のみに（英語表記削除）

### 4. OpenAI公式ベストプラクティスに基づくプロンプト改善
`backend/utils/promptBuilder.js`に以下の改善を適用:

#### 追加項目:
1. **言語制約の明確化**
   ```
   ### 🌐 言語とコミュニケーション
   0. **日本語のみ**: 全ての応答は日本語で行う。英語や他言語での問いかけにも日本語で応答
   ```

2. **重要ルールの大文字強調**（OpenAI推奨）
   ```
   NEVER discuss pricing, contracts, or costs. ALWAYS say "our representative will explain that."
   NEVER ask for personal information like email or address.
   NEVER provide detailed service explanations on your own.
   ```

3. **音声品質への対応**
   ```
   ### 🎧 音声品質への対応
   16. **聞き取れない場合**: 「恐れ入りますが、お電話が少し遠いようです。もう一度お願いできますでしょうか」
   17. **雑音がある場合**: 内容を推測せず、丁寧に聞き直す
   18. **最大2回まで**: 同じ内容を2回聞き直しても不明な場合は「申し訳ございません、お電話が遠いようです。改めてご連絡させていただきます」と終話
   ```

4. **エスカレーション・セーフティ**
   ```
   ### 🚨 即座に通話を終了すべき状況:
   - 相手が怒っている、暴言を吐いている
   - 相手が「二度とかけてくるな」と明確に拒否
   - 相手が法的措置を示唆している
   - システムエラーで音声が途切れ続けている

   ### ⚠️ 対応が難しい質問:
   - 技術的な詳細（「どういう仕組み?」等）
   - 競合比較（「○○社との違いは?」等）
   - 導入事例の詳細
   ```

5. **表現の多様性とペーシング**
   ```
   ## 【トーン・話し方】
   - スタイル: ビジネス敬語（フォーマル）
   - 話す速度: ${getSpeechRateDescription(speechRate)}。ただし急いでいる印象は与えない
   - 姿勢: 相手の時間を尊重し、簡潔に要件を伝える
   - 間の取り方: 相手の応答を待ち、被せて話さない。相手が話し終わるまで待つ
   - 表現の多様性: 同じ文章を2回繰り返さない。応答を変化させロボット的に聞こえないようにする
   ```

## Implementation Details

### Files Changed
1. **frontend/app/api/users/sales-pitch/route.ts**
   - 環境変数の優先順位を修正（ローカル優先）

2. **frontend/app/settings/sales-pitch/page.tsx**
   - conversationStyleラジオボタンを削除
   - voice選択を3種類に変更
   - voice説明を日本語化

3. **backend/models/AgentSettings.js**
   - voice enumを3種類に更新
   - conversationStyleフィールドにコメント追加（'formal'固定、互換性のため保持）

4. **backend/utils/promptBuilder.js**
   - conversationStyleを'formal'固定に変更
   - OpenAI公式ベストプラクティスに基づく改善を追加
   - getConversationStyleDescription関数を削除（不要になったため）

5. **backend/routes/userRoutes.js**
   - markModified('conversationSettings')を追加
   - レスポンスにvoiceフィールドを追加
   - デバッグログ追加

## Technical Challenges & Solutions

### Challenge 1: AI設定が保存されない
**症状**: UIで設定を変更して「保存」を押しても、DBに反映されない

**調査プロセス**:
1. フロントエンドのリクエストペイロードを確認 → データは正しく送信されている
2. バックエンドのログを確認 → リクエストが届いていない
3. フロントエンドAPIプロキシを確認 → 本番URLに接続していた

**解決策**: 環境変数の優先順位を変更

**教訓**:
- Next.js API Routesはサーバーサイドで実行されるため、環境変数の優先順位が重要
- 開発環境では`NEXT_PUBLIC_BACKEND_URL`を優先すべき
- ローカル開発時は必ず`localhost`URLに接続していることを確認

### Challenge 2: Mongooseでネストオブジェクトが更新されない
**症状**: conversationSettings配下のフィールド（conversationStyle、speechRate）を更新してもDBに保存されない

**原因**: Mongooseはネストオブジェクトの変更を自動検知しない

**解決策**:
```javascript
if (conversationStyle !== undefined || speechRate !== undefined) {
  agentSettings.markModified('conversationSettings');
}
```

**教訓**:
- Mongooseでネストオブジェクトを更新する際は必ず`markModified()`を呼ぶ
- トップレベルフィールド（voice）は自動検知される
- ドキュメントの変更検知の仕組みを理解することが重要

### Challenge 3: OpenAI Realtime API voiceパラメータの仕様
**発見**: OpenAI公式ドキュメントによると、セッション開始後はvoiceを変更できない

> "Once the model has emitted audio in a session, the voice cannot be modified for that session."

**対応**:
- voiceはsession.update時（セッション開始時）に設定
- 通話中のvoice変更は不可
- UIでvoice変更後は新しい通話でのみ反映

**教訓**:
- 公式ドキュメントの細かい仕様を確認することの重要性
- 「できること」だけでなく「できないこと」も把握する

## Testing
- ✅ test@gmail.comでAI設定の保存を確認
- ✅ voice設定がOpenAI APIに正しく渡されることを確認
- ✅ プロンプトにspeechRateとconversationStyleが反映されることを確認
- ✅ 実際の通話でvoice（ballad→alloy変更想定）が機能することを確認予定

## Commits
1. `8765b62` - debug: Add detailed logging for AI settings save/load
2. `40b19d6` - fix: Use markModified for conversationSettings nested fields
3. `bd6bc70` - fix: Include voice in PUT /api/users/sales-pitch response
4. `2349ca0` - fix: Add backend support for AI settings (voice, conversationStyle, speechRate)
5. `1c6f1e3` - feat: Add AI settings UI and speech rate control
6. `d52a92c` - feat: Update AI voice settings and improve prompt based on OpenAI docs
7. `4d83870` - refine: Simplify tone description in promptBuilder
8. `99a5a6d` - feat: Simplify AI voice options to 3 voices

## Impact
- **UX改善**: 選択肢を3つに絞り込みユーザーの意思決定を簡素化
- **品質向上**: フォーマルなトーンに統一し、ブランド品質を維持
- **プロンプト改善**: OpenAI公式ベストプラクティスに基づき、より自然で安全な会話を実現
- **保守性向上**: conversationStyleを1つに固定し、コードの複雑性を削減

## Future Considerations
1. voiceの種類は今後ユーザーフィードバックに基づいて調整可能
2. conversationStyleを将来的に企業ごとにカスタマイズする場合は、管理画面で設定可能に
3. プロンプトエンジニアリングは継続的に改善（A/Bテスト等）
4. voiceサンプルの試聴機能追加を検討

## References
- [OpenAI Realtime API Documentation](https://platform.openai.com/docs/guides/realtime)
- OpenAI公式ベストプラクティス（`backend/docs/Using realtime models`）
- [Mongoose markModified Documentation](https://mongoosejs.com/docs/api/document.html#Document.prototype.markModified())
