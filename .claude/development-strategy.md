# AI Call System 開発戦略・継続方針

> **重要**: このファイルは開発継続時に必ず最初に読み込むこと
> **指示**: どんな質問や依頼を受けても、まずこの戦略に基づいてサブエージェントを積極活用する

## 🚀 プロジェクト概要

**AI自動電話対応システム** - Twilioベースの企業向け自動電話営業システム

### 技術スタック
- **Backend**: Node.js/Express + MongoDB Atlas
- **Frontend**: Next.js 15 + TypeScript
- **通話**: Twilio Voice/Conference API
- **AI**: OpenAI + Coefont音声合成
- **リアルタイム**: Socket.io

## 🎯 現在の開発状況（2025-08-29時点）

### ✅ 完了済み
- [x] ローカル環境構築完了
- [x] システム起動確認済み（backend:5001, frontend:3000）
- [x] MongoDB Atlas接続済み
- [x] 管理者アカウント作成済み（admin@example.com/admin123）
- [x] 依存関係問題解決済み
- [x] Linux用起動スクリプト作成（start-linux.sh）
- [x] ngrokローカルインストール済み（./tools/ngrok）

### 🔴 高優先度課題（即座に着手すべき）
1. **一斉コール連続実行問題**
   - ハンドオフ後の終話検知が未実装
   - 人間対応後の自動次発信が不完全
   - Conference終了イベント処理が不十分

2. **通話ログのリアルタイム表示問題**  
   - WebSocket接続タイミングによる初期ログ取得漏れ
   - バッファリング機能未実装

3. **Twilio番号の企業紐付け問題**
   - PhonePoolからの確実な番号割り当て未実装
   - 企業専用番号管理が不完全

## 👥 専門サブエージェント戦略

### 必須ルール
> **どんな開発タスクでも、関連するサブエージェントを必ず最初に活用すること**

### 活用可能なサブエージェント
1. **twilio-integration-specialist** - Twilio API統合全般
2. **realtime-comm-architect** - WebSocket/リアルタイム通信
3. **ai-dialogue-engineer** - OpenAI対話システム
4. **voice-processing-specialist** - 音声処理（Coefont等）
5. **multitenant-db-architect** - MongoDB設計・最適化
6. **frontend-ux-designer** - Next.js UI実装
7. **security-auth-expert** - 認証・セキュリティ
8. **devops-infra-engineer** - インフラ・デプロイ

### サブエージェント活用原則
- **Task開始前**: 必ず関連するサブエージェントに相談
- **複雑な問題**: 複数サブエージェントの並行活用
- **コード修正**: 該当分野の専門エージェントが実装
- **新機能開発**: アーキテクチャ設計から専門エージェントが担当

## 📋 次回開始時の行動指針

### 1. 最初に実行すること
```bash
# システム状態確認
./start-linux.sh

# プロセス確認
ps aux | grep -E "(node|ngrok)" | grep -v grep

# API動作確認  
curl http://localhost:5001/health
```

### 2. 優先課題への対応方法
```
ユーザーからの依頼 → 関連サブエージェント特定 → Task実行 → 問題解決
```

### 3. サブエージェント選択基準
- **Twilio関連** → twilio-integration-specialist
- **WebSocket/リアルタイム** → realtime-comm-architect  
- **DB設計/最適化** → multitenant-db-architect
- **フロントエンド** → frontend-ux-designer
- **認証/セキュリティ** → security-auth-expert

## 🛠️ 開発環境情報

### ローカル環境
- **OS**: Linux (WSL2)
- **Node.js**: v22.16.0
- **MongoDB**: Atlas (クラウド)
- **ngrok**: ./tools/ngrok (ローカル)

### 起動コマンド
```bash
# 完全起動
./start-linux.sh

# 個別起動
cd backend && npm run dev  # :5001
cd frontend && npm run dev # :3000
```

### 環境ファイル
- `backend/.env` - 設定済み（Twilio, MongoDB Atlas, JWT等）
- `frontend/.env.local` - 自動生成済み

## 📄 重要ファイル参照

### システム分析
- `システム実装状況分析レポート.md` - 詳細な機能実装状況
- `README.md` - プロジェクト概要・セットアップ手順

### 技術仕様
- `docs/call-status-management.md` - 通話状態管理
- `docs/multi-tenant-architecture.md` - マルチテナント設計
- `handoff_implementation_plan.md` - ハンドオフ実装計画

## 🎯 今後の開発目標

### 短期（1-2週間）
- [ ] ハンドオフ後の終話検知実装
- [ ] 通話ログのリアルタイム表示改善  
- [ ] 番号管理システムの改善

### 中期（1ヶ月）
- [ ] 音声再生・ダウンロード機能
- [ ] AIスクリプト最適化UI
- [ ] 通話品質改善

### 長期（3ヶ月）
- [ ] 高度な分析機能
- [ ] パフォーマンス最適化
- [ ] スケールアウト対応

---

## 🚨 重要な注意事項

1. **必ずサブエージェントを活用**: 個人で解決しようとせず、専門エージェントに依頼
2. **TodoWrite積極使用**: 複雑なタスクは必ず進捗管理
3. **既存コード優先**: 新規作成よりも既存修正を重視
4. **テストコード**: 都度判断で必要に応じて実装

---

*作成日: 2025-08-29*  
*最終更新: システム起動テスト完了時*