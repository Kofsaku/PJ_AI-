# 改訂版実装計画 - ユーザーフィードバック反映

**作成日**: 2025-10-18
**ステータス**: フィードバック反映済み

---

## 📋 ユーザーフィードバック

### ✅ 不要な機能（実装しない）

1. ~~Conference APIフォールバック~~ → **不要**
2. ~~会話テンプレートエンジン~~ → **不要**（OpenAIプロンプト直接制御）
3. ~~音声キャッシュ・CDN~~ → **不要**

### 🎯 新たに必要な機能

1. **GUIへの統合** → **最優先**（ユーザーはGUIで使用する）
2. **トークスクリプト設定機能** → **重要**（GUI上で設定可能に）

---

## 🚀 改訂版優先順位

### 🔴 Phase 3: GUI統合（最優先 - 1週間以内）

**目的**: ユーザーがGUIから通話機能を利用できるようにする

#### 3.1 フロントエンド既存機能の確認

**確認項目**:
- [ ] 現在のGUIにRealtime API対応がされているか
- [ ] 通話開始ボタンの動作確認
- [ ] 通話状態の表示確認
- [ ] 会話履歴の表示確認

**ファイル**:
```
frontend/app/calls/page.tsx
frontend/app/components/CallInterface.tsx
frontend/app/api/calls/route.ts
```

**推定工数**: 2-4時間（確認・分析）

---

#### 3.2 Realtime API対応のフロントエンド修正

**必要な変更**:

1. **通話開始処理の確認**
```typescript
// frontend/app/api/calls/route.ts または類似
// Realtime API使用時の通話開始処理

// 確認事項:
// - USE_OPENAI_REALTIME フラグの確認
// - WebSocket URL生成の確認
// - CallSession作成の確認
```

2. **通話状態の表示**
```typescript
// リアルタイムステータス表示
// - in-progress
// - ringing
// - completed
// WebSocket通知の受信確認
```

3. **会話履歴の表示**
```typescript
// realtimeConversation の表示
// - AI応答の表示
// - （将来）ユーザー発話の表示
// - タイムスタンプの表示
```

**推定工数**: 4-8時間

---

#### 3.3 トークスクリプト設定画面の実装

**新規機能**:

**場所**:
- `frontend/app/agents/[id]/talk-script/page.tsx` （新規作成）
- または既存のエージェント設定画面に追加

**UI要素**:
```typescript
interface TalkScriptSettings {
  // OpenAI Realtime API用プロンプト
  systemPrompt: string;          // "You are a helpful assistant..."

  // 音声設定
  voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

  // 会話設定
  temperature: number;            // 0.0 - 1.0

  // （オプション）詳細設定
  maxOutputTokens?: number;
  toolsEnabled?: boolean;
}
```

**フォーム例**:
```tsx
<Form>
  <TextArea
    label="システムプロンプト（トークスクリプト）"
    name="systemPrompt"
    rows={10}
    placeholder="あなたは親切で明るいAIアシスタントです。..."
  />

  <Select
    label="音声"
    name="voice"
    options={[
      { value: 'alloy', label: 'Alloy（デフォルト）' },
      { value: 'nova', label: 'Nova（女性）' },
      { value: 'shimmer', label: 'Shimmer（女性・明るい）' },
      // ...
    ]}
  />

  <Slider
    label="Temperature（応答のランダム性）"
    name="temperature"
    min={0}
    max={1}
    step={0.1}
    defaultValue={0.8}
  />

  <Button type="submit">保存</Button>
</Form>
```

**バックエンドAPI**:
```typescript
// PUT /api/agents/:id/talk-script
// AgentSettings.conversationSettings を更新
{
  conversationSettings: {
    customTemplates: {
      initial: systemPrompt  // ← ここに保存
    },
    voice: voice,
    temperature: temperature
  }
}
```

**推定工数**: 6-10時間

---

#### 3.4 既存GUIとの統合テスト

**テスト項目**:
- [ ] GUI経由で通話開始できる
- [ ] リアルタイムで通話状態が更新される
- [ ] 会話履歴がGUIに表示される
- [ ] トークスクリプト設定が反映される
- [ ] 複数エージェント間で設定が独立している

**推定工数**: 4-6時間

**Phase 3 総工数**: 16-28時間（2-4日）

---

### 🟡 Phase 4: コア機能の完成（2週間以内）

#### 4.1 ユーザー発話トランスクリプト保存

**実装内容**:
```javascript
// backend/controllers/mediaStreamController.js

// Session更新時にtranscription有効化
const sessionUpdate = {
  type: "session.update",
  session: {
    // ... 既存設定 ...
    input_audio_transcription: {
      model: "whisper-1"
    }
  }
};

// 新しいイベントハンドラー追加
if (response.type === 'conversation.item.input_audio_transcription.completed') {
  const transcript = response.transcript;
  const itemId = response.item_id;

  // ユーザーメッセージを保存
  callSession.realtimeConversation.push({
    type: 'message',
    role: 'user',
    content: [{
      type: 'input_audio',
      transcript: transcript
    }],
    timestamp: new Date(),
    itemId: itemId  // 追跡用
  });

  await callSession.save();
  console.log('[Conversation] User transcript saved:', transcript);
}
```

**推定工数**: 2-3時間

---

#### 4.2 オペレーター転送機能

**実装内容**:

1. **Function Calling設定**
```javascript
// AgentSettingsにFunction定義追加
tools: [{
  type: "function",
  name: "transfer_to_operator",
  description: "オペレーターに転送する必要がある場合に呼び出す",
  parameters: {
    type: "object",
    properties: {
      reason: {
        type: "string",
        description: "転送理由（例：複雑な質問、クレーム対応など）"
      }
    },
    required: ["reason"]
  }
}]
```

2. **Function Call処理**
```javascript
// response.function_call_output イベント処理
if (response.type === 'response.function_call_arguments.done') {
  const functionCall = response.call;

  if (functionCall.name === 'transfer_to_operator') {
    const args = JSON.parse(functionCall.arguments);

    // 転送処理
    await handleOperatorTransfer(callSession, args.reason);
  }
}

async function handleOperatorTransfer(callSession, reason) {
  // 1. Realtime API WebSocket切断
  openaiWs.close();

  // 2. Conferenceに接続（既存コード再利用）
  const conference = await createConference(callSession.twilioCallSid);

  // 3. オペレーター呼び出し
  await callOperator(conference.sid, callSession.assignedAgent);

  // 4. 転送記録
  callSession.handoffReason = reason;
  callSession.handoffAt = new Date();
  await callSession.save();
}
```

**推定工数**: 8-12時間

---

#### 4.3 通話録音機能の確認・修正

**確認項目**:
```javascript
// TwiML生成時にRecording設定
const response = new VoiceResponse();
response.record({
  recordingStatusCallback: `${BASE_URL}/api/twilio/recording-status`,
  recordingStatusCallbackEvent: ['completed'],
  trim: 'trim-silence',
  transcribe: false  // Whisperで別途実施
});

const connect = response.connect();
connect.stream({ url: streamUrl });
```

**修正内容**:
- Realtime API使用時の録音設定確認
- 録音ファイル保存先の確認
- ダウンロードAPI動作確認

**推定工数**: 2-4時間

**Phase 4 総工数**: 12-19時間（2-3日）

---

### 🟢 Phase 5: 最適化・本番準備（1ヶ月以内）

#### 5.1 セキュリティ強化

- helmet()再有効化（WebSocket例外設定）
- CORS設定の最適化
- 環境変数の検証

**推定工数**: 2-3時間

---

#### 5.2 パフォーマンステスト

- 同時通話テスト（5-10件）
- 長時間通話テスト（10分以上）
- ネットワーク遅延テスト

**推定工数**: 4-6時間

---

#### 5.3 エラーハンドリング強化

- OpenAI API障害時の処理
- ネットワーク切断時の処理
- タイムアウト処理の最適化

**推定工数**: 4-6時間

**Phase 5 総工数**: 10-15時間（2-3日）

---

## 📊 総合スケジュール

| Phase | 内容 | 期間 | 工数 |
|-------|------|------|------|
| Phase 3 | **GUI統合**（最優先） | 2-4日 | 16-28h |
| Phase 4 | コア機能完成 | 2-3日 | 12-19h |
| Phase 5 | 最適化・本番準備 | 2-3日 | 10-15h |
| **合計** | | **1-2週間** | **38-62h** |

---

## 🎯 Phase 3 詳細タスクリスト

### Week 1: GUI統合

#### Day 1-2: 既存GUI分析・設計

**タスク**:
1. 既存のフロントエンドコード確認
   - [ ] `frontend/app/calls/` ディレクトリ構造確認
   - [ ] 通話開始API確認
   - [ ] WebSocket通知受信確認
   - [ ] 会話履歴表示確認

2. Realtime API対応の必要な変更を特定
   - [ ] TwiML生成処理の確認
   - [ ] WebSocket URL生成の確認
   - [ ] 通話状態管理の確認

3. トークスクリプト設定画面の設計
   - [ ] ワイヤーフレーム作成
   - [ ] UI/UXレビュー
   - [ ] バックエンドAPI設計

**成果物**:
- 実装仕様書
- ワイヤーフレーム
- API仕様書

---

#### Day 3-4: 実装

**タスク**:
1. トークスクリプト設定画面の実装
   - [ ] ページコンポーネント作成
   - [ ] フォーム実装
   - [ ] バックエンドAPI実装
   - [ ] 保存・読み込み機能

2. 既存GUI修正
   - [ ] Realtime API対応の確認・修正
   - [ ] 会話履歴表示の調整
   - [ ] エラー表示の追加

3. 統合テスト
   - [ ] 通話開始テスト
   - [ ] トークスクリプト反映テスト
   - [ ] 会話履歴表示テスト

**成果物**:
- 動作する設定画面
- 修正されたGUI
- テスト結果レポート

---

## 📝 現在の実装状況（Phase 2完了時点）

### ✅ 完了している機能

1. **バックエンド**:
   - WebSocket統合（本番環境対応）
   - データベース統合
   - AI応答ログ保存
   - リアルタイム音声通信

2. **API**:
   - `/api/twilio/voice` - 着信処理
   - `/api/twilio/media-stream/:callId` - WebSocket接続
   - `/api/twilio/status` - ステータス更新

### ⚠️ 未確認・要修正

1. **フロントエンド**:
   - Realtime API対応状況不明
   - トークスクリプト設定画面なし
   - 会話履歴表示の対応状況不明

2. **機能**:
   - ユーザー発話トランスクリプト未保存
   - オペレーター転送未実装
   - 通話録音機能未確認

---

## 🔍 次のアクション（優先順）

### 1. 既存フロントエンドの調査（2-4時間）

**目的**: 現在のGUIがどこまでRealtime APIに対応しているか確認

**手順**:
```bash
# フロントエンドのコード確認
cd frontend
grep -r "OPENAI_REALTIME" .
grep -r "media-stream" .
grep -r "realtimeConversation" .
```

**確認項目**:
- [ ] 通話開始時にRealtime APIフラグを確認しているか
- [ ] WebSocket通知を受信しているか
- [ ] 会話履歴を表示しているか
- [ ] エージェント設定を読み込んでいるか

---

### 2. トークスクリプト設定画面の実装（6-10時間）

**実装場所の選択肢**:

**Option A**: 既存のエージェント設定に追加
```
frontend/app/agents/[id]/edit/page.tsx
↓ タブ追加
frontend/app/agents/[id]/talk-script/page.tsx
```

**Option B**: 独立した設定ページ
```
frontend/app/talk-scripts/page.tsx
frontend/app/talk-scripts/[id]/edit/page.tsx
```

**推奨**: Option A（既存UIとの一貫性）

---

### 3. 統合テスト（4-6時間）

**テストシナリオ**:
1. GUIからエージェント設定を開く
2. トークスクリプトを編集・保存
3. 通話を開始
4. 設定したプロンプトが反映されているか確認
5. 会話履歴がGUIに表示されるか確認

---

## 💡 技術的な考慮事項

### フロントエンドでの表示

```typescript
// 会話履歴の型定義
interface ConversationItem {
  type: 'message';
  role: 'user' | 'assistant';
  content: Array<{
    type: 'input_audio' | 'output_audio';
    transcript?: string;
  }>;
  timestamp: Date;
}

// 表示コンポーネント
function ConversationHistory({ items }: { items: ConversationItem[] }) {
  return (
    <div className="conversation-history">
      {items.map((item, index) => (
        <div key={index} className={`message ${item.role}`}>
          <div className="role">{item.role === 'user' ? 'ユーザー' : 'AI'}</div>
          <div className="content">
            {item.content[0]?.transcript || '（音声のみ）'}
          </div>
          <div className="timestamp">
            {new Date(item.timestamp).toLocaleString('ja-JP')}
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## 📈 成功指標

### Phase 3完了時点

- [ ] GUIから通話開始可能
- [ ] トークスクリプトをGUIで設定可能
- [ ] 設定したプロンプトが実際の通話に反映される
- [ ] 会話履歴がGUIに表示される
- [ ] ユーザーが実際に使用可能な状態

### Phase 4完了時点

- [ ] ユーザー発話もログに保存される
- [ ] オペレーター転送が動作する
- [ ] 通話録音が正常に保存される

### Phase 5完了時点

- [ ] 本番環境デプロイ可能
- [ ] 同時通話10件以上対応
- [ ] セキュリティ要件満たす

---

**次のステップ**: Phase 3-1「既存フロントエンドの調査」から開始
