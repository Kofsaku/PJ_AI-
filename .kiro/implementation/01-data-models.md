# データモデル実装

## 実装済みモデル

### 1. CallSession Model
- **ファイル**: `/backend/models/CallSession.js`
- **機能**:
  - 通話セッションの完全な管理
  - Twilio Call SIDとConference SIDの追跡
  - 通話ステータス管理（initiated → ai-responding → transferring → human-connected → completed/failed）
  - 会話の文字起こし記録
  - 引き継ぎ時刻と理由の記録
  - 通話結果の分類（成功、不在、拒否、要フォロー、失敗）
  - AI設定情報の保存

- **主要メソッド**:
  - `calculateDuration()`: 通話時間の計算
  - `getActiveCalls()`: アクティブな通話の取得
  - `getCallStatistics()`: 通話統計の集計

### 2. AgentStatus Model
- **ファイル**: `/backend/models/AgentStatus.js`
- **機能**:
  - エージェントのリアルタイムステータス管理
  - ステータス種別：available, busy, on-call, offline
  - 現在の通話IDの追跡
  - 通話処理統計（総通話数、総通話時間、平均応答時間）

- **主要メソッド**:
  - `updateStatus()`: ステータス更新
  - `getAvailableAgents()`: 利用可能なエージェント取得
  - `getLeastBusyAgent()`: 最も負荷の低いエージェント取得
  - `updateCallStatistics()`: 通話統計の更新

### 3. AgentSettings Model
- **ファイル**: `/backend/models/AgentSettings.js`
- **機能**:
  - エージェントの電話番号設定
  - 会話テンプレート設定（会社名、サービス名、担当者名、部署名）
  - カスタマイズ可能な応答テンプレート
  - 通知設定と勤務時間管理
  - 優先度設定によるルーティング制御

- **主要メソッド**:
  - `processTemplate()`: テンプレート変数の置換
  - `isWithinWorkingHours()`: 勤務時間内チェック
  - `getAvailableAgents()`: 利用可能なエージェント取得
  - `getInternationalPhoneNumber()`: 国際電話番号形式への変換

## データベース設計のポイント

### インデックス戦略
- CallSession: customerId, assignedAgent, status, twilioCallSid でインデックス
- AgentStatus: userId, status でインデックス
- AgentSettings: userId, isAvailable + priority でインデックス

### リレーション
- CallSession → Customer（顧客情報）
- CallSession → User（担当エージェント）
- AgentStatus → User（エージェント）
- AgentSettings → User（エージェント）

### バリデーション
- 電話番号形式のチェック（日本国内・国際形式）
- Enumによるステータス値の制限
- 必須フィールドの設定

## 次のステップ
1. エージェント管理APIの実装
2. Conference対応通話管理APIの構築
3. リアルタイム通信システムの実装