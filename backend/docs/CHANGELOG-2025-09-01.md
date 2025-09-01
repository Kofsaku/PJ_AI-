# Changelog - 2025年9月1日

## 概要
AI通話システムの大幅なコードクリーンアップと転送処理の修正を実施。

## 🔧 修正された問題

### 1. 転送タイミングの修正
- **問題**: 初回「少々お待ちください」で即座に転送が実行される
- **原因**: `understanding_response`が`transfer_confirmed`にマッピングされていた
- **修正**: インテントマッピングを整理し、転送は`transfer_agreement`でのみ実行

### 2. キーワード重複エラーの解決
- **問題**: 「お待ちください」で複数パターンが競合しアプリケーションエラー
- **原因**: `afterInitialQuestion.transfer_wait`と`waitingForTransfer.transfer_confirmed`で重複
- **修正**: `waitingForTransfer.transfer_confirmed`から重複キーワードを削除

### 3. 担当者変更認識の修正
- **問題**: 「変わりました。担当の〇〇です」が`unknown`として処理される
- **原因**: `transfer_wait`後に`waitingForTransfer`状態に移行していない
- **修正**: `transfer_wait`で状態のみ`WAITING_FOR_TRANSFER`に移行するよう追加

## 🗑️ 削除されたコンポーネント (12項目)

### インテント・テンプレート
1. `understanding_response` - 転送同意と重複、混乱の原因
2. `interest_response` - 詳細要求（未使用）
3. `transfer_request` - `transfer_agreement`と重複
4. `give_details` - セールス詳細（未使用）
5. `service_detail` - サービス詳細（未使用）
6. `continue_conversation` - フォローアップ質問（未使用）
7. `handoff_message` - 3者通話用（不要）
8. `positive_decision` - 検討インテント（未使用）
9. `request_materials` - 資料要求インテント（未使用）
10. `transfer_preparation` - 引き継ぎ準備テンプレート（未使用）

### 会話状態
11. `afterSalesPitch` - セールスピッチ後の状態（未使用）
12. `AFTER_SALES_PITCH` - 対応する状態定数

### 関連テンプレート
- `sales_pitch_detailed`
- `sales_pitch_short`
- `follow_up`

## ✅ 改善効果

### 転送処理の明確化
- **正しいフロー**: 初回挨拶 → 担当者確認 → 転送説明 → 転送同意 → 転送実行
- **転送トリガー**: `transfer_agreement`インテントでのみ転送実行
- **応答**: 「ありがとうございます。転送いたしますので少々お待ち下さい。」

### コードの簡素化
- **削除行数**: 約200行以上のコード削除
- **インテント数**: 18個から6個に削減
- **複雑な3者通話ロジック**: シンプル転送に統一

### システム安定性
- **誤分類の排除**: キーワード重複による競合を解消
- **明確な状態管理**: 曖昧な中間状態を削除
- **予測可能な動作**: 確定的な会話フローを実現

## 📁 修正されたファイル

### 設定ファイル
- `/backend/config/templates.js` - インテント・テンプレート・状態定義の大幅整理

### コアロジック
- `/backend/services/conversationEngine.js` - インテント処理の簡素化と修正
- `/backend/controllers/twilioController.js` - 転送検出ロジックの修正

### データモデル
- `/backend/models/AgentSettings.js` - 未使用テンプレートの削除

## 🎯 現在の会話フロー

```
1. AI初回挨拶: 「営業部のご担当者さまは...」
2. 顧客応答: 「少々お待ちください」
3. AI応答: 「ありがとうございます。よろしくお願いいたします。」
4. 担当者変更: 「変わりました。担当の〇〇です。」
5. AI再説明: サービス概要と転送提案
6. 転送同意: 「わかりました」
7. 転送実行: 「転送いたしますので少々お待ち下さい。」→ エージェント直接転送
```

## 🧪 テスト状況
- ✅ サーバー起動確認
- ✅ テンプレート設定検証通過
- ✅ 会話状態遷移の確認
- ✅ 転送ロジックの動作確認

---
*このクリーンアップにより、AI通話システムはより安定で保守しやすい状態になりました。*