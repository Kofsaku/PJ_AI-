# フロントエンド統合分析レポート

**作成日**: 2025-10-18
**調査者**: Claude Code
**ステータス**: ⚠️ **要修正** - 現在はConference方式のみ対応

---

## 🔍 調査結果サマリー

### 現在の状態

✅ **GUI基盤**: 完全に実装済み
- 通話開始UI
- 通話履歴表示
- WebSocket通知受信
- エージェント設定

⚠️ **Realtime API統合**: **未対応**
- 現在の通話はすべてConference方式
- Realtime APIへの切り替え未実装

---

## 📁 主要ファイルの分析

### 1. フロントエンド通話開始API

**ファイル**: `frontend/app/api/calls/start/route.ts`

**処理フロー**:
```typescript
POST /api/calls/start (Frontend Next.js API)
  ↓
POST ${BACKEND_URL}/api/calls/start (Backend Express)
  ↓
callController.startCall()
```

**現状**: シンプルなプロキシ、特に問題なし

---

### 2. バックエンド通話開始処理

**ファイル**: `backend/controllers/callController.js`

**問題箇所（77行目）**:
```javascript
// ❌ 現在: Conference方式
const call = await client.calls.create({
  to: customer.phone,
  from: fromNumber,
  url: `${process.env.BASE_URL}/api/twilio/voice/conference/${callSession._id}`,
  // ...
});
```

**必要な修正**:
```javascript
// ✅ 修正後: Realtime API方式
const call = await client.calls.create({
  to: customer.phone,
  from: fromNumber,
  url: `${process.env.BASE_URL}/api/twilio/voice`,  // ← Realtime API用エンドポイント
  // ...
});
```

---

## ⚠️ 発見した問題

### 問題1: URLエンドポイントの不一致

**現在の動作**:
```
GUI通話開始
  ↓
/api/twilio/voice/conference/{callSessionId}  ← Conference方式
  ↓
Conference Room作成
  ↓
従来のGather + OpenAI Chat API
```

**期待する動作**:
```
GUI通話開始
  ↓
/api/twilio/voice  ← Realtime API方式
  ↓
Media Streams WebSocket接続
  ↓
OpenAI Realtime API (All-in-One)
```

---

### 問題2: CallSession作成タイミング

**現在**:
```javascript
// callController.startCall()
// 1. CallSession作成（twilioCallSid: 'pending'）
// 2. Twilio通話開始
// 3. CallSession更新（twilioCallSid: call.sid）
```

**Realtime API方式での動作**:
```javascript
// twilioVoiceController.handleIncomingCall()
// 1. Twilioから着信（From, To, CallSid）
// 2. CallSession検索/作成
// 3. TwiML生成（WebSocket URL含む）
```

**問題**:
- GUIから発信する場合、`twilioVoiceController` は呼ばれない
- CallSessionは `callController.startCall()` で作成される
- **両方の動作を統合する必要がある**

---

## 🔧 必要な修正

### 修正1: callController.startCall() の更新

**目的**: Realtime API方式で通話開始できるようにする

**修正内容**:
```javascript
// backend/controllers/callController.js

exports.startCall = asyncHandler(async (req, res, next) => {
  const { customerId, agentId } = req.body;

  // 顧客情報取得
  const customer = await Customer.findById(customerId);
  if (!customer) {
    return next(new ErrorResponse('Customer not found', 404));
  }

  // エージェント設定取得
  const agentSettings = await AgentSettings.findOne({ userId: agentId || req.user._id });
  if (!agentSettings) {
    return next(new ErrorResponse('Agent settings not found', 404));
  }

  const userId = agentId || req.user._id;

  // 通話セッション作成
  const callSession = await CallSession.create({
    customerId,
    twilioCallSid: 'pending',
    status: 'initiated',
    assignedAgent: userId,
    aiConfiguration: {
      companyName: agentSettings.conversationSettings.companyName,
      serviceName: agentSettings.conversationSettings.serviceName,
      representativeName: agentSettings.conversationSettings.representativeName,
      targetDepartment: agentSettings.conversationSettings.targetDepartment,
      serviceDescription: agentSettings.conversationSettings.serviceDescription,
      targetPerson: agentSettings.conversationSettings.targetPerson,
      salesPitch: agentSettings.conversationSettings.salesPitch
    }
  });

  try {
    const user = await User.findById(userId);

    if (!user || !user.twilioPhoneNumber || user.twilioPhoneNumberStatus !== 'active') {
      await CallSession.findByIdAndDelete(callSession._id);
      return next(new ErrorResponse('No phone number assigned', 400));
    }

    const fromNumber = user.twilioPhoneNumber;

    // ✅ Realtime API対応: エンドポイント選択
    const useRealtimeAPI = process.env.USE_OPENAI_REALTIME === 'true';
    const voiceUrl = useRealtimeAPI
      ? `${process.env.BASE_URL}/api/twilio/voice`  // Realtime API
      : `${process.env.BASE_URL}/api/twilio/voice/conference/${callSession._id}`;  // Conference

    console.log(`[CallController] Using ${useRealtimeAPI ? 'Realtime API' : 'Conference'} mode`);
    console.log(`[CallController] Voice URL: ${voiceUrl}`);

    // Twilio通話開始
    const call = await client.calls.create({
      to: customer.phone,
      from: fromNumber,
      url: voiceUrl,
      statusCallback: `${process.env.BASE_URL}/api/twilio/call/status/${callSession._id}`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      record: true,
      recordingStatusCallback: `${process.env.BASE_URL}/api/twilio/recording/status/${callSession._id}`
    });

    // CallSession更新
    callSession.twilioCallSid = call.sid;
    callSession.status = 'ai-responding';
    await callSession.save();

    // WebSocket通知
    if (global.io) {
      global.io.emit('call-started', {
        callId: callSession._id,
        customerId,
        customerName: customer.name,
        status: 'ai-responding',
        startTime: callSession.startTime
      });
    }

    res.status(201).json({
      success: true,
      data: {
        callId: callSession._id,
        twilioCallSid: call.sid,
        status: callSession.status,
        mode: useRealtimeAPI ? 'realtime' : 'conference'
      }
    });
  } catch (error) {
    await CallSession.findByIdAndDelete(callSession._id);
    return next(new ErrorResponse(`Failed to start call: ${error.message}`, 500));
  }
});
```

**変更点**:
1. `USE_OPENAI_REALTIME` 環境変数でモード判定
2. Realtime API時は `/api/twilio/voice` を使用
3. レスポンスに `mode` フィールド追加（デバッグ用）

---

### 修正2: twilioVoiceController の更新

**目的**: GUIから開始された通話でも正しくCallSessionを取得

**現在の問題**:
```javascript
// backend/controllers/twilioVoiceController.js (56行目付近)
let tempCallSession = await CallSession.findOne({ twilioCallSid: CallSid })
  .populate('assignedAgent');
```

GUIから開始時:
- CallSessionは既に存在（`callController.startCall()` で作成）
- しかし `twilioCallSid` は 'pending'
- Twilioの実際のCallSidと一致しない

**修正内容**:
```javascript
// backend/controllers/twilioVoiceController.js

exports.handleIncomingCall = asyncHandler(async (req, res) => {
  console.log('============================================');
  console.log('[Incoming Call] NEW CALL RECEIVED');
  console.log('[Incoming Call] From:', req.body.From);
  console.log('[Incoming Call] To:', req.body.To);
  console.log('[Incoming Call] CallSid:', req.body.CallSid);
  console.log('[Incoming Call] CallStatus:', req.body.CallStatus);
  console.log('============================================');

  const { From, To, CallSid } = req.body;
  const twiml = new VoiceResponse();

  try {
    // 電話番号の正規化
    let phoneNumber = From;
    if (phoneNumber.startsWith('+81')) {
      phoneNumber = '0' + phoneNumber.substring(3);
    }

    // ✅ CallSession検索: twilioCallSid OR 発信先電話番号で検索
    let callSession = await CallSession.findOne({
      $or: [
        { twilioCallSid: CallSid },  // 既にSidが設定されている場合
        {
          twilioCallSid: 'pending',  // GUIから開始された場合
          status: { $in: ['initiated', 'ai-responding'] },
          createdAt: { $gte: new Date(Date.now() - 60000) }  // 直近1分以内
        }
      ]
    })
    .sort({ createdAt: -1 })  // 最新を優先
    .populate('assignedAgent');

    // CallSessionが見つかったら、CallSidを更新
    if (callSession && callSession.twilioCallSid === 'pending') {
      console.log('[Incoming Call] Updating pending CallSession with CallSid:', CallSid);
      callSession.twilioCallSid = CallSid;
      await callSession.save();
    }

    // CallSessionが見つからない場合は新規作成（通常の着信）
    if (!callSession) {
      console.log('[Incoming Call] Creating new call session for incoming call');

      // 顧客検索/作成
      let customer = await Customer.findOne({ phone: phoneNumber });
      if (!customer) {
        customer = await Customer.create({
          userId: 'default-user',
          customer: '新規顧客',
          company: '未設定',
          phone: phoneNumber,
          date: new Date().toLocaleDateString('ja-JP'),
          time: new Date().toLocaleTimeString('ja-JP'),
          duration: '0:00',
          result: '通話中'
        });
      }

      // CallSession作成
      callSession = await CallSession.create({
        customerId: customer._id,
        twilioCallSid: CallSid,
        status: 'in-progress',
        assignedAgent: null  // デフォルトエージェント
      });
    }

    console.log('[Incoming Call] Using CallSession:', callSession._id);

    // AgentSettings取得
    let agentSettings = null;
    if (callSession.assignedAgent) {
      agentSettings = await AgentSettings.findOne({ userId: callSession.assignedAgent._id });
      console.log('[Incoming Call] AgentSettings loaded for user:', callSession.assignedAgent._id);
    }

    // ✅ Realtime API使用判定
    const useRealtimeAPI = process.env.USE_OPENAI_REALTIME === 'true';
    console.log('[Incoming Call] USE_OPENAI_REALTIME:', useRealtimeAPI);

    if (useRealtimeAPI) {
      // Realtime API方式
      const connect = twiml.connect();

      const useSimpleEndpoint = process.env.USE_SIMPLE_MEDIA_STREAM === 'true';
      const streamUrl = useSimpleEndpoint
        ? `wss://${req.headers.host}/api/twilio/media-stream-simple`
        : `wss://${req.headers.host}/api/twilio/media-stream/${callSession._id}`;

      console.log('[Incoming Call] Realtime API - Stream URL:', streamUrl);
      connect.stream({ url: streamUrl });

    } else {
      // Conference方式（従来）
      const connect = twiml.connect();
      connect.conference({
        endConferenceOnExit: true,
        statusCallback: `${process.env.BASE_URL}/api/twilio/conference/status/${callSession._id}`,
        statusCallbackEvent: ['start', 'end', 'join', 'leave']
      }, `conference_${callSession._id}`);
    }

    console.log('[Incoming Call] Sending TwiML response');
    res.type('text/xml').send(twiml.toString());

  } catch (error) {
    console.error('[Incoming Call] ERROR:', error);
    const errorTwiml = new VoiceResponse();
    errorTwiml.say({ voice: 'Polly.Mizuki', language: 'ja-JP' },
                    'エラーが発生しました。しばらくしてからおかけ直しください。');
    errorTwiml.hangup();
    res.type('text/xml').send(errorTwiml.toString());
  }
});
```

**変更点**:
1. CallSession検索を改善（pending状態も検索）
2. pending CallSessionを実際のCallSidで更新
3. `USE_OPENAI_REALTIME` フラグでモード切り替え
4. Conference方式との互換性維持

---

## 📋 実装チェックリスト

### Phase 3-1: バックエンド修正（2-3時間）

- [ ] `backend/controllers/callController.js` を修正
  - [ ] `USE_OPENAI_REALTIME` フラグ対応
  - [ ] voiceUrl条件分岐追加
  - [ ] ログ追加

- [ ] `backend/controllers/twilioVoiceController.js` を修正
  - [ ] CallSession検索ロジック改善
  - [ ] pending状態の更新処理
  - [ ] モード切り替え対応

- [ ] 環境変数確認
  - [ ] `USE_OPENAI_REALTIME=true`
  - [ ] `USE_SIMPLE_MEDIA_STREAM=false`（本番版使用）

---

### Phase 3-2: テスト（1-2時間）

- [ ] GUIからの通話開始テスト
  - [ ] Conference方式（USE_OPENAI_REALTIME=false）
  - [ ] Realtime API方式（USE_OPENAI_REALTIME=true）

- [ ] 直接着信テスト（Realtime API）
  - [ ] 新規顧客の着信
  - [ ] 既存顧客の着信

- [ ] CallSession整合性確認
  - [ ] twilioCallSid正しく設定されるか
  - [ ] assignedAgent正しく設定されるか
  - [ ] status遷移が正しいか

---

### Phase 3-3: フロントエンド確認（1-2時間）

- [ ] 通話履歴表示の確認
  - [ ] `realtimeConversation` フィールドの表示
  - [ ] AI応答の表示

- [ ] WebSocket通知の確認
  - [ ] 通話開始通知
  - [ ] ステータス更新通知
  - [ ] 通話終了通知

---

## 🎯 次のステップ

1. **即座に実装**: バックエンド修正（上記コード）
2. **テスト**: GUIから通話開始して動作確認
3. **Phase 3-4へ**: トークスクリプト設定画面の実装

---

## 💡 重要な発見

### GUI通話とダイレクト着信の違い

**GUI通話** (callController.startCall):
```
1. フロントエンドから /api/calls/start
2. CallSession作成（twilioCallSid: 'pending'）
3. Twilio.calls.create() で発信
4. Twilioから /api/twilio/voice にコールバック
5. CallSessionをCallSidで更新
6. TwiML返却（WebSocket URL含む）
```

**ダイレクト着信**:
```
1. Twilioから直接 /api/twilio/voice にコールバック
2. CallSession検索（見つからなければ新規作成）
3. TwiML返却（WebSocket URL含む）
```

**統合のポイント**:
- 両方のフローで正しくCallSessionを特定
- pending状態の処理
- エージェント割り当ての整合性

---

**ステータス**: 修正内容明確、実装準備完了
