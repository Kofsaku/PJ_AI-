# .claude ディレクトリ - Claude Code 開発継続設定

このディレクトリは **Claude Code での開発継続性を確保** するための設定ファイル群です。

## 📋 ファイル構成

### `session-context.md`
**新セッション開始時に最初に読み込む必須ファイル**
- 前回セッションの成果
- 現在のシステム状態  
- 次回開始時の必須アクション
- 高優先度課題一覧

### `development-strategy.md`  
**開発戦略・サブエージェント活用方針**
- プロジェクト概要・技術スタック
- サブエージェント戦略（8つの専門エージェント）
- 優先課題・開発目標
- 環境設定情報

## 🚨 重要な使用方法

### 新セッション開始時の手順
1. **必須**: `session-context.md` を最初に読み込み
2. **推奨**: `development-strategy.md` でサブエージェント戦略確認  
3. システム状態確認・必要に応じて起動
4. 高優先度課題から着手

### サブエージェント活用原則
> **どんな開発依頼でも、関連するサブエージェントを必ず最初に活用する**

- Twilio関連 → `twilio-integration-specialist`
- WebSocket/リアルタイム → `realtime-comm-architect`  
- フロントエンド → `frontend-ux-designer`
- DB設計 → `multitenant-db-architect`
- 認証 → `security-auth-expert`
- インフラ → `devops-infra-engineer`
- AI対話 → `ai-dialogue-engineer`
- 音声処理 → `voice-processing-specialist`

## 🎯 開発継続のメリット

1. **コンテキスト保持**: セッション間の情報継承
2. **効率的開発**: サブエージェント専門性活用
3. **品質向上**: 一貫した開発方針
4. **迅速な問題解決**: 高優先度課題の明確化

---

**作成目的**: AI Call System の継続的開発における効率性・一貫性の確保  
**作成日**: 2025-08-29