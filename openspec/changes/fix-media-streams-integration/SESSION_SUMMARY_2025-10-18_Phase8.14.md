# Session Summary: Conversation History Display Implementation (2025-10-18 Phase 8.14)

**Date**: 2025-10-18
**Session**: Phase 8.14 - 通話中の会話履歴表示機能実装
**Status**: ✅ COMPLETED (次の課題: プロンプト変数置換)

---

## 🎯 Session Goals

1. 通話中のモーダルウィンドウに会話履歴をリアルタイム表示
2. AIオペレーターの発話テキストを表示
3. お客様（ユーザー）の発話テキストを表示
4. 既存のフロントエンドコンポーネント（CallStatusModal）を活用
5. OpenAI Realtime APIの転写機能を調査・実装

---

## ✅ Completed Work

### Phase 8.14: 会話履歴リアルタイム表示機能

**要件**:
- ✅ トーク中にモーダルウィンドウで会話履歴を表示
- ✅ AIオペレーターの発話を青色で表示
- ✅ お客様の発話を緑色で表示
- ✅ リアルタイムでWebSocket経由で更新
- ✅ MongoDBに会話履歴を保存

**実装アプローチ**:
段階的実装（初回の完全実装で音声停止エラー発生後、段階的に変更）

1. **Step 1**: ヘルパー関数のみ追加
2. **Step 2**: AI発話の抽出とWebSocket送信 → **成功** ✅
3. **Step 3**: ユーザー音声転写の有効化 → **成功** ✅

---

## 🔧 Technical Implementation

### 1. テキスト抽出関数の実装

**ファイル**: `backend/controllers/mediaStreamController.js` (lines 25-48)

**目的**: OpenAI Realtime APIの異なるcontent typeから転写テキストを統一的に抽出

```javascript
function extractTextFromContent(content) {
  if (!content || !Array.isArray(content)) {
    return '';
  }

  const textParts = content
    .filter(item => {
      return item.type === 'text' ||
             item.type === 'input_text' ||
             item.type === 'output_text' ||
             item.type === 'output_audio' ||  // AI音声の転写対応
             item.type === 'audio';
    })
    .map(item => {
      return item.transcript || item.text || '';  // transcriptフィールド優先
    })
    .filter(text => text.length > 0);

  return textParts.join(' ').trim();
}
```

**対応Content Types**:
- `output_audio`: AI音声応答（`transcript`フィールドを使用）
- `text`, `input_text`, `output_text`: テキスト応答
- `audio`: 音声データ（`transcript`フィールド使用）

### 2. WebSocket送信関数の実装

**ファイル**: `backend/controllers/mediaStreamController.js` (lines 50-74)

**目的**: フロントエンドへリアルタイムで会話更新を送信

```javascript
function sendConversationUpdate(callSession, role, text) {
  if (!text || !global.io) return;

  const speaker = role === 'assistant' ? 'ai' : role === 'user' ? 'customer' : 'system';
  const phoneNumber = callSession.phoneNumber;

  global.io.emit('transcript-update', {
    callId: callSession._id.toString(),
    callSid: callSession.twilioCallSid,
    phoneNumber: phoneNumber,
    speaker: speaker,
    text: text,
    message: text,
    timestamp: new Date()
  });

  console.log('[Conversation] Sent WebSocket update:', {
    callId: callSession._id.toString(),
    speaker: speaker,
    textLength: text.length
  });
}
```

**Speaker Mapping**:
- `assistant` → `ai` (AIオペレーター、青色表示)
- `user` → `customer` (お客様、緑色表示)
- `system` → `system`

### 3. ユーザー音声転写の有効化

**ファイル**: `backend/controllers/mediaStreamController.js` (lines 87-99)

**OpenAI Session Configuration**:

```javascript
session: {
  type: "realtime",
  audio: {
    input: {
      format: { type: "audio/pcmu" },
      turn_detection: { type: "server_vad" },
      transcription: {  // ✅ 正しい配置: audio.input内
        model: "whisper-1"
      }
    },
    output: {
      format: { type: "audio/pcmu" },
      voice: agentSettings?.voice || "alloy"
    }
  },
  // ...
}
```

**重要**: `transcription`は`audio.input`内に配置する必要あり（トップレベルではない）

### 4. ユーザー転写完了イベント処理

**ファイル**: `backend/controllers/mediaStreamController.js` (lines 268-296)

**Event Type**: `conversation.item.input_audio_transcription.completed`

```javascript
if (response.type === 'conversation.item.input_audio_transcription.completed') {
  const transcript = response.transcript;
  const itemId = response.item_id;

  console.log('[User Transcription] Completed:', {
    itemId: itemId,
    transcript: transcript
  });

  if (transcript && transcript.length > 0) {
    // MongoDBに保存
    callSession.realtimeConversation.push({
      type: 'message',
      role: 'user',
      content: [{
        type: 'input_audio',
        transcript: transcript
      }],
      timestamp: new Date()
    });

    await callSession.save();
    console.log('[User Transcription] Saved to database');

    // フロントエンドへWebSocket送信
    sendConversationUpdate(callSession, 'user', transcript);
  }
}
```

### 5. AI応答完了イベント処理

**ファイル**: `backend/controllers/mediaStreamController.js` (lines 309-314)

**Event Type**: `response.done`

```javascript
const text = extractTextFromContent(item.content);
console.log('[Conversation] Extracted text:', text || '(empty)',
  'from content types:', item.content.map(c => c.type).join(', '));
if (text) {
  sendConversationUpdate(callSession, item.role, text);
}
```

---

## 🐛 Errors and Fixes

### Error 1: 完全な音声停止（初回実装時）

**症状**:
- すべての機能を一度に実装した後、システムが無音になる
- AI応答なし、ユーザー音声認識なし

**原因**: 複数の変更を同時に適用したため、エラー箇所の特定が困難

**修正**:
```bash
git restore controllers/mediaStreamController.js
pkill -f "node.*server\.js"
cd /root/work_claude/PJ_AI-/backend && npm start
```

**結果**: ✅ ベースライン機能が復旧

**ユーザーフィードバック**: "良い判断です。音声が動作しました。段階的に変更していきましょう。"

### Error 2: 転写設定の誤った配置

**症状**:
- ユーザー転写機能を追加した直後、再び音声応答が停止

**誤ったコード**:
```javascript
session: {
  type: "realtime",
  audio: { ... },
  input_audio_transcription: {  // ❌ トップレベルに配置（誤り）
    model: "whisper-1"
  }
}
```

**OpenAI公式ドキュメント確認**:
`docs/Realtime_API/Usage` (line 1576):
```
audio.input.transcription: Optional asynchronous transcription of input audio.
```

**正しいコード**:
```javascript
session: {
  type: "realtime",
  audio: {
    input: {
      format: { type: "audio/pcmu" },
      turn_detection: { type: "server_vad" },
      transcription: {  // ✅ audio.input内に配置（正解）
        model: "whisper-1"
      }
    },
    output: { ... }
  }
}
```

**修正結果**: ✅ ユーザー音声転写が正常に動作

**ユーザーフィードバック**: スクリーンショットで緑色（お客様）と青色（AIオペレーター）の両方のメッセージが表示されることを確認

---

## 📊 Test Results

### データベース確認

**スクリプト**: `backend/check-conversation.js`

**結果**:
```javascript
realtimeConversation: [
  {
    role: 'assistant',
    content: [{
      type: 'output_audio',
      transcript: 'こんにちは！お話しできてうれしいです...'
    }]
  },
  {
    role: 'assistant',
    content: [{
      type: 'output_audio',
      transcript: 'もしもし、聞こえますか？...'
    }]
  }
]
```

✅ 会話データは正常にMongoDBに保存されている

### フロントエンド表示確認

**コンポーネント**: `frontend/components/calls/CallStatusModal.tsx`

**機能**:
- ✅ `transcript-update` WebSocketイベントをリッスン
- ✅ AI発話を青色で「AIオペレーター」として表示
- ✅ ユーザー発話を緑色で「お客様」として表示
- ✅ 自動スクロールで最新メッセージを表示

**ユーザー確認**:
- Step 2後: "素晴らしいAIオペレーターの会話が表示されました。"
- Step 3後: スクリーンショットで両方のメッセージ表示を確認

---

## ⚠️ Identified Issue: Prompt Variable Replacement

### 問題発見

**ユーザーフィードバック**: "会話の内容が明らかに意味不明でした。これはプロンプトで何か指示を入れている？"

**調査結果**: `backend/config/templates.js` (line 67)

```javascript
initial: 'お世話になります。{{selfIntroduction}}。弊社は{{serviceDescription}}会社でございます。{{serviceName}}について、是非御社の{{targetDepartment}}にご案内できればと思いお電話をさせていただきました。本日、{{targetPerson}}はいらっしゃいますでしょうか？'
```

**OpenAIへ送信されるinstructions**（実際のログ）:
```json
{
  "instructions": "お世話になります。{{selfIntroduction}}。弊社は{{serviceDescription}}会社でございます..."
}
```

**問題**:
- ❌ テンプレート変数が置換されずに、そのままOpenAIに送信されている
- ❌ AIが`{{variable}}`をそのまま処理しようとし、意味不明な応答を生成

**必要な変数**:
- `{{selfIntroduction}}` - 自己紹介
- `{{serviceDescription}}` - サービス説明
- `{{serviceName}}` - サービス名
- `{{targetDepartment}}` - 対象部署
- `{{targetPerson}}` - 対象者名

**データソース**: `AgentSettings` MongoDB モデル
- `companyName`
- `serviceName`
- `representativeName`
- その他のカスタムフィールド

---

## 📁 Modified Files

### Code Changes

1. **backend/controllers/mediaStreamController.js**:
   - Lines 25-48: `extractTextFromContent()` 関数追加
   - Lines 50-74: `sendConversationUpdate()` 関数追加
   - Lines 87-99: Session configuration with user transcription
   - Lines 268-296: User transcription event handler
   - Lines 309-314: AI response WebSocket emission

2. **backend/check-conversation.js**:
   - データベース確認用スクリプト作成（デバッグ用）

### Git Status

現在のブランチ: `add-openai`

**未コミット変更**:
```
M  backend/controllers/mediaStreamController.js
?? backend/check-conversation.js
```

---

## 🎓 Key Learnings

### 1. OpenAI Realtime API Content Types

**AI音声応答**:
- Type: `output_audio`
- Text field: `transcript` (NOT `text`)

**ユーザー音声**:
- Type: `input_audio`
- Text field: `transcript`
- Requires: `audio.input.transcription` configuration

### 2. 段階的実装の重要性

**失敗例**:
- すべての機能を一度に実装 → 完全な音声停止
- エラー箇所の特定が困難

**成功例**:
- Step 1: ヘルパー関数のみ
- Step 2: AI発話抽出とWebSocket → テスト → **成功**
- Step 3: ユーザー転写設定 → テスト → **成功**

### 3. OpenAI設定の正確な階層構造

**誤り**: トップレベルに`input_audio_transcription`を配置
**正解**: `audio.input.transcription`内に配置

**ドキュメント参照の重要性**: 公式ドキュメント（`docs/Realtime_API/Usage`）で正確な構造を確認

### 4. WebSocket共存アーキテクチャ

システムには2種類のWebSocketが共存:
- **Twilio Media Streams**: OpenAI Realtime APIとの音声通信
- **Socket.io**: フロントエンドへのリアルタイム通知（`transcript-update`イベント）

両者は独立して動作し、異なる目的を持つ。

---

## 🚀 Next Steps

### Phase 8.15: プロンプト変数置換の実装 (NEXT TASK)

**目的**: テンプレート変数を実際のAgentSettings値で置換

**実装箇所**: `backend/controllers/mediaStreamController.js` の `initializeSession` 関数

**必要な処理**:
1. AgentSettingsをMongoDBから取得
2. テンプレート変数を抽出（`{{variableName}}`パターン）
3. AgentSettingsの対応フィールドで置換
4. 置換済みのinstructionsをOpenAIに送信

**期待結果**:
- ✅ AIが具体的な会社名、サービス名を使用
- ✅ 会話内容が意味のあるものになる
- ✅ お客様に適切な自己紹介を行う

### その他の残りタスク (Phase 8)

- [ ] 8.8: Test interrupt handling (user interrupts AI mid-response)
- [ ] 8.9: Verify conversation logs saved to database ✅ (完了済み)
- [ ] 8.10: Test concurrent calls (2-3 simultaneous)
- [ ] 8.11: Test legacy mode fallback (USE_OPENAI_REALTIME=false)

---

## ✨ Summary

**2025-10-18 Phase 8.14セッションの成果**:
- ✅ 会話履歴リアルタイム表示機能を実装
- ✅ AI発話（青色）とユーザー発話（緑色）を両方表示
- ✅ OpenAI Whisper-1でユーザー音声転写を有効化
- ✅ MongoDBへの会話保存を確認
- ✅ WebSocket経由でフロントエンドへリアルタイム配信
- ⚠️ プロンプト変数未置換の問題を発見（次タスク）

**所要時間**: 約2時間（段階的実装とエラー修正含む）
**修正行数**: 約100行追加
**影響範囲**:
- バックエンド: mediaStreamController.js
- フロントエンド: CallStatusModal.tsx（既存コンポーネント活用）

**Status**: ✅ **PHASE 8.14 COMPLETED**

**Next**: Phase 8.15 - Prompt Variable Replacement
