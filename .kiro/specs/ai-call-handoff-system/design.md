# Design Document

## Overview

AIコールシステムは、営業担当者が効率的に見込み顧客にアプローチできるよう、AIが初期の受付対応を自動化し、適切なタイミングで人間の営業担当者に通話を引き継ぐシステムです。

システムの核となる機能は、リアルタイムでの通話監視と任意のタイミングでの人間への引き継ぎです。営業担当者はダッシュボード上で進行中の通話を監視し、「取り次ぎ」ボタンをクリックすることで、AIから人間に即座に通話を転送できます。

## Architecture

### システム構成
```
Frontend (Next.js)
├── Dashboard (リアルタイム通話監視)
├── Customer Management (顧客管理)
└── Call History (通話履歴)

Backend (Express.js + MongoDB)
├── Customer API
├── Call Management API
├── User Authentication API
└── WebSocket Server (リアルタイム通信)

External Services
├── Twilio (音声通話・TwiML)
├── Speech Recognition (音声認識)
└── Text-to-Speech (音声合成)
```

### データフロー
1. 営業担当者が顧客リストから通話を開始
2. TwilioがAI音声応答を実行し、Conferenceを作成
3. リアルタイム通信（WebSocket/SSE）で通話状況をダッシュボードに送信
4. 営業担当者が「取り次ぎ」ボタンをクリック
5. HTTP API経由で通話転送指示を送信
6. TwilioのConference APIで営業担当者をConferenceに追加
7. AIをConferenceから削除し、営業担当者と顧客が直接会話
8. 通話結果をデータベースに記録

## Components and Interfaces

### Frontend Components

#### 1. リアルタイム通話監視ダッシュボード
```typescript
interface CallMonitorDashboard {
  activeCalls: ActiveCall[]
  onHandoffCall: (callId: string) => void
  onEndCall: (callId: string) => void
}

interface ActiveCall {
  id: string
  customerId: string
  customerName: string
  status: 'ai-responding' | 'transferring' | 'human-connected'
  startTime: Date
  transcript: ConversationMessage[]
  assignedAgent?: string
}
```

#### 2. 取り次ぎボタンコンポーネント
```typescript
interface HandoffButton {
  callId: string
  isEnabled: boolean
  onHandoff: (callId: string) => void
}
```

#### 3. 営業担当者設定画面
```typescript
interface AgentSettings {
  phoneNumber: string
  isAvailable: boolean
  conversationSettings: ConversationSettings
  notificationPreferences: NotificationSettings
}

interface ConversationSettings {
  companyName: string          // 発信側会社名
  serviceName: string          // 提供サービス名
  representativeName: string   // 発信者名
  targetDepartment: string     // 先方部署名（例：営業部、総務部）
  customTemplates?: {          // カスタム応答テンプレート（オプション）
    initial?: string
    clarification?: string
    company_confirmation?: string
    absent?: string
    rejection?: string
    website_redirect?: string
    closing?: string
  }
}

interface NotificationSettings {
  enableCallNotifications: boolean
  enableEmailNotifications: boolean
  workingHours: {
    start: string
    end: string
    timezone: string
  }
}
```

### Backend APIs

#### 1. Call Management API
```typescript
// GET /api/calls/active - 進行中の通話一覧取得
// POST /api/calls/handoff - 通話の人間への転送
// POST /api/calls/end - 通話終了
// GET /api/calls/history - 通話履歴取得

interface CallSession {
  id: string
  customerId: string
  twilioCallSid: string
  status: CallStatus
  startTime: Date
  endTime?: Date
  assignedAgent?: string
  transcript: ConversationMessage[]
  handoffTime?: Date
  callResult?: string
}
```

#### 2. Agent Management API
```typescript
// GET /api/agents/profile - 営業担当者プロフィール取得
// PUT /api/agents/profile - 営業担当者プロフィール更新
// PUT /api/agents/phone - 電話番号設定・更新
// PUT /api/agents/conversation - 会話設定更新
// PUT /api/agents/status - 可用性ステータス更新

interface AgentProfile {
  id: string
  name: string
  email: string
  phoneNumber: string
  isAvailable: boolean
  currentCallId?: string
  settings: AgentSettings
}
```

#### 3. Real-time Communication
```typescript
// リアルタイム通信（WebSocket または Server-Sent Events）
interface RealtimeEvents {
  'call-started': ActiveCall
  'call-updated': ActiveCall
  'call-ended': { callId: string, result: string }
  'transcript-update': { callId: string, message: ConversationMessage }
}

// HTTP API for handoff
// POST /api/calls/{callId}/handoff
interface HandoffRequest {
  callId: string
  agentId: string
  agentPhoneNumber: string
}
```

### AI Conversation Flow

#### 1. 会話変数設定
```typescript
interface ConversationVariables {
  my_company_name: string      // 発信側会社名
  my_service_name: string      // 提供サービス名
  my_representative_name: string // 発信者名
  callee_department: string    // 先方部署名
}
```

#### 2. 会話フロー定義
```typescript
interface ConversationFlow {
  initial: string              // 開始時の挨拶
  clarification: string        // 無言/「はい？」への対応
  company_confirmation: string // 社名再確認への対応
  absent: string              // 不在時の対応
  rejection: string           // 新規お断りへの対応
  website_redirect: string    // HP/メール誘導への対応
  closing: string             // 終了時の挨拶
}

// 会話例テンプレート
const conversationTemplates = {
  initial: "お世話になります。{{my_company_name}}の{{my_representative_name}}と申します。{{my_service_name}}のご案内でお電話しました。本日、{{callee_department}}のご担当者さまはいらっしゃいますでしょうか？",
  clarification: "失礼しました。{{my_company_name}}の{{my_representative_name}}です。{{my_service_name}}についてご担当者さまにご案内の可否を伺っております。",
  company_confirmation: "{{my_company_name}}でございます。{{my_representative_name}}です。",
  absent: "承知しました。では、また改めてお電話いたします。ありがとうございました。",
  rejection: "承知いたしました。本日は突然のご連絡で失礼いたしました。よろしくお願いいたします。",
  website_redirect: "承知しました。御社ホームページのお問い合わせフォームですね。記載のうえ送付いたします。ありがとうございました。",
  closing: "本日はありがとうございました。失礼いたします。"
}
```

#### 3. 音声認識・応答判定
```typescript
interface ResponseClassification {
  intent: 'silent' | 'unclear' | 'company_inquiry' | 'absent' | 'rejection' | 'website_redirect' | 'transfer_ready'
  confidence: number
  shouldHandoff: boolean
  nextAction: 'continue' | 'handoff' | 'end_call'
}

// 応答パターン判定ロジック
function classifyResponse(speechText: string): ResponseClassification {
  // 音声認識結果から意図を分類
  // 担当者に繋がりそうな場合は shouldHandoff: true
}
```

### Twilio Integration

#### 1. Conference-based Call Flow
```xml
<!-- AI応答フェーズ - Conferenceに参加 -->
<Response>
  <Say voice="Polly.Mizuki" language="ja-JP">
    お世話になります。AIコールシステムの安達と申します。
  </Say>
  <Dial>
    <Conference 
      statusCallback="/api/twilio/conference/status"
      statusCallbackEvent="start end join leave"
      statusCallbackMethod="POST"
      record="record-from-start"
      recordingStatusCallback="/api/twilio/recording/status">
      call-{callId}
    </Conference>
  </Dial>
</Response>

<!-- 人間転送フェーズ - 営業担当者をConferenceに追加 -->
<Response>
  <Say voice="Polly.Mizuki" language="ja-JP">
    担当者におつなぎいたします。少々お待ちください。
  </Say>
  <Dial>
    <Conference>call-{callId}</Conference>
  </Dial>
</Response>
```

#### 2. Conference Management API
```typescript
// Conference参加者の管理
interface ConferenceParticipant {
  callSid: string
  conferenceSid: string
  role: 'customer' | 'ai' | 'agent'
  status: 'connected' | 'hold' | 'muted'
}

// 転送処理
async function transferToAgent(callId: string, agentPhoneNumber: string) {
  // 1. 営業担当者をConferenceに追加
  const agentCall = await client.calls.create({
    to: agentPhoneNumber,
    from: process.env.TWILIO_PHONE_NUMBER,
    url: `/api/twilio/conference/join/${callId}`,
    statusCallback: `/api/twilio/call/status`
  });
  
  // 2. AIをConferenceから削除（mute or remove）
  await client.conferences(conferenceSid)
    .participants(aiParticipantSid)
    .update({ muted: true });
}
```

## Data Models

### Call Session Model
```javascript
const callSessionSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  twilioCallSid: { type: String, required: true, unique: true },
  status: { 
    type: String, 
    enum: ['initiated', 'ai-responding', 'transferring', 'human-connected', 'completed', 'failed'],
    default: 'initiated'
  },
  startTime: { type: Date, default: Date.now },
  endTime: Date,
  assignedAgent: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  transcript: [{
    timestamp: Date,
    speaker: { type: String, enum: ['ai', 'customer', 'agent'] },
    message: String,
    confidence: Number
  }],
  handoffTime: Date,
  handoffReason: String,
  callResult: {
    type: String,
    enum: ['成功', '不在', '拒否', '要フォロー', '失敗']
  },
  notes: String,
  duration: Number
}, { timestamps: true });
```

### Agent Status Model
```javascript
const agentStatusSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { 
    type: String, 
    enum: ['available', 'busy', 'on-call', 'offline'],
    default: 'offline'
  },
  currentCallId: { type: mongoose.Schema.Types.ObjectId, ref: 'CallSession' },
  lastActivity: { type: Date, default: Date.now }
}, { timestamps: true });
```

### Agent Settings Model
```javascript
const agentSettingsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  phoneNumber: { type: String, required: true },
  isAvailable: { type: Boolean, default: true },
  conversationSettings: {
    companyName: { type: String, required: true },
    serviceName: { type: String, required: true },
    representativeName: { type: String, required: true },
    targetDepartment: { type: String, required: true },
    customTemplates: {
      initial: String,
      clarification: String,
      company_confirmation: String,
      absent: String,
      rejection: String,
      website_redirect: String,
      closing: String
    }
  },
  notificationPreferences: {
    enableCallNotifications: { type: Boolean, default: true },
    enableEmailNotifications: { type: Boolean, default: false },
    workingHours: {
      start: { type: String, default: '09:00' },
      end: { type: String, default: '18:00' },
      timezone: { type: String, default: 'Asia/Tokyo' }
    }
  }
}, { timestamps: true });
```

## Error Handling

### 通話転送エラー
- Twilioの通話が存在しない場合
- 営業担当者が利用不可の場合
- ネットワーク接続エラー

### WebSocket接続エラー
- 接続断絶時の自動再接続
- メッセージ配信失敗時のリトライ
- クライアント側での状態同期

### AI応答エラー
- 音声認識失敗時のフォールバック
- TwiML生成エラー時の標準応答
- 予期しない会話フローでの人間転送

## Testing Strategy

### Unit Tests
- Call Management API のテスト
- WebSocket イベントハンドリングのテスト
- TwiML 生成ロジックのテスト
- データモデルのバリデーションテスト

### Integration Tests
- Twilio API との統合テスト
- WebSocket 通信のエンドツーエンドテスト
- データベース操作の統合テスト

### E2E Tests
- 通話開始から終了までの完全フロー
- 複数通話の同時処理
- エラーシナリオでの動作確認

### Manual Testing
- 実際の電話での音声品質確認
- UI/UXの使いやすさ検証
- 営業担当者による実用性テスト