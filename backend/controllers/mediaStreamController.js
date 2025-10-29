/**
 * Media Streams Controller for OpenAI Realtime API Integration
 * Based on: https://github.com/twilio-samples/speech-assistant-openai-realtime-api-python
 *
 * This controller bridges Twilio Media Streams and OpenAI Realtime API via WebSocket
 */

const WebSocket = require('ws');
const CallSession = require('../models/CallSession');
const AgentSettings = require('../models/AgentSettings');
const { buildOpenAIInstructions } = require('../utils/promptBuilder');

// Event types to log (from official sample line 25-30)
const LOG_EVENT_TYPES = [
  'error',
  'response.content.done',
  'rate_limits.updated',
  'response.done',
  'input_audio_buffer.committed',
  'input_audio_buffer.speech_stopped',
  'input_audio_buffer.speech_started',
  'session.created',
  'session.updated',
  'response.output_item.done',  // For Function Calling detection
  'response.function_call_arguments.done'  // Alternative event name
];

/**
 * Execute automatic call termination when customer rejects the offer
 * @param {Object} callSession - CallSession document
 * @param {String} functionCallId - OpenAI function call ID
 * @param {Object} args - Function arguments (rejection_reason)
 */
async function executeAutoCallEnd(callSession, functionCallId, args) {
  try {
    console.log('[AutoCallEnd] 顧客拒否による自動切電を実行');
    console.log('[AutoCallEnd] CallSession ID:', callSession._id);
    console.log('[AutoCallEnd] Function Call ID:', functionCallId);
    console.log('[AutoCallEnd] 拒否理由:', args.rejection_reason);

    // CallSessionの更新
    callSession.status = 'completed';
    callSession.endTime = new Date();
    callSession.callResult = '拒否';  // 顧客応答結果
    callSession.endReason = 'ai_initiated';
    callSession.notes = args.rejection_reason ? `AI判断による切電: ${args.rejection_reason}` : 'AI判断による切電';

    await callSession.save();
    console.log('[AutoCallEnd] CallSession更新完了');

    // Twilio通話終了
    if (callSession.twilioCallSid && callSession.twilioCallSid !== 'pending') {
      const twilioService = require('../services/twilioService');
      await twilioService.endCall(callSession.twilioCallSid);
      console.log('[AutoCallEnd] Twilio通話終了完了:', callSession.twilioCallSid);
    }

    // WebSocket通知
    if (global.io) {
      const eventData = {
        customerId: callSession.customerId?.toString() || callSession.customerId,
        phoneNumber: callSession.phoneNumber,
        status: 'completed',
        callResult: '拒否',
        callId: callSession._id.toString(),
        twilioCallSid: callSession.twilioCallSid
      };
      global.io.emit('callStatusUpdate', eventData);
      console.log('[WebSocket] Emitted callStatusUpdate: completed (拒否)', JSON.stringify(eventData));
    }

    return {
      success: true,
      message: '通話を終了しました'
    };

  } catch (error) {
    console.error('[AutoCallEnd] エラー:', error);
    return {
      success: false,
      message: '切電処理に失敗しました',
      error: error.message
    };
  }
}

/**
 * Execute automatic handoff when AI determines transfer is appropriate
 * @param {Object} callSession - CallSession document
 * @param {String} functionCallId - OpenAI function call ID
 * @param {Object} args - Function arguments (customer_consent, reason)
 */
async function executeAutoHandoff(callSession, functionCallId, args) {
  try {
    console.log('[AutoHandoff] Executing automatic handoff');
    console.log('[AutoHandoff] CallSession ID:', callSession._id);
    console.log('[AutoHandoff] Function Call ID:', functionCallId);
    console.log('[AutoHandoff] Arguments:', args);

    // 顧客の同意確認
    if (args.customer_consent !== true) {
      console.log('[AutoHandoff] Customer did not consent, skipping handoff');
      return;
    }

    // CallSessionからユーザー情報を取得
    const userId = callSession.assignedAgent;
    if (!userId) {
      console.error('[AutoHandoff] No assigned agent for this call session');
      return;
    }

    const User = require('../models/User');
    const user = await User.findById(userId);

    if (!user) {
      console.error('[AutoHandoff] User not found:', userId);
      return;
    }

    if (!user.handoffPhoneNumber) {
      console.error('[AutoHandoff] No handoff phone number configured for user:', userId);
      return;
    }

    console.log('[AutoHandoff] User found:', user.email);
    console.log('[AutoHandoff] Handoff phone:', user.handoffPhoneNumber);

    // 既存のhandoffControllerロジックを利用
    const handoffController = require('./handoffController');

    // ハンドオフ実行
    const result = await handoffController.executeHandoffLogic(
      callSession,
      user,
      'ai-auto',  // ハンドオフ方法
      args.reason || '顧客の承諾'  // 転送理由
    );

    console.log('[AutoHandoff] Handoff executed successfully:', result);

    // Function call の結果をOpenAIに返す（成功）
    return {
      success: true,
      message: '担当者への転送を開始しました',
      handoffCallSid: result.handoffCallSid
    };

  } catch (error) {
    console.error('[AutoHandoff] Error executing handoff:', error);

    // Function call の結果をOpenAIに返す（失敗）
    return {
      success: false,
      message: '転送に失敗しました。申し訳ございません。',
      error: error.message
    };
  }
}

/**
 * Extract text from OpenAI Realtime API content array
 * Content can include: output_audio (with transcript), output_text, text, input_text, input_audio, etc.
 */
function extractTextFromContent(content) {
  if (!content || !Array.isArray(content)) {
    return '';
  }

  const textParts = content
    .filter(item => {
      return item.type === 'text' ||
             item.type === 'input_text' ||
             item.type === 'output_text' ||
             item.type === 'output_audio' ||
             item.type === 'audio';
    })
    .map(item => {
      return item.transcript || item.text || '';
    })
    .filter(text => text.length > 0);

  return textParts.join(' ').trim();
}

/**
 * Send conversation update via WebSocket (memory storage only)
 */
function sendConversationUpdate(callSession, role, text) {
  if (!text || !global.io) return;

  const speaker = role === 'assistant' ? 'ai' : role === 'user' ? 'customer' : 'system';
  const phoneNumber = callSession.phoneNumber;
  const timestamp = new Date();

  // トランスクリプトをメモリに保存（通話終了時にDBに一括保存）
  if (!callSession.transcript) {
    callSession.transcript = [];
  }
  callSession.transcript.push({
    speaker: speaker,
    message: text,
    timestamp: timestamp
  });
  console.log('[Conversation] Stored in memory:', {
    callId: callSession._id.toString(),
    speaker: speaker,
    transcriptLength: callSession.transcript.length
  });

  // WebSocketでリアルタイム送信
  global.io.emit('transcript-update', {
    callId: callSession._id.toString(),
    callSid: callSession.twilioCallSid,
    phoneNumber: phoneNumber,
    speaker: speaker,
    text: text,
    message: text,
    timestamp: timestamp
  });

  console.log('[Conversation] Sent WebSocket update:', {
    callId: callSession._id.toString(),
    speaker: speaker,
    textLength: text.length
  });
}

/**
 * Initialize OpenAI Realtime API session
 * Reference: official sample line 209-231
 */
async function initializeSession(openaiWs, agentSettings) {
  // Build instructions using the new prompt builder (受付突破特化型)
  let instructions;
  try {
    instructions = buildOpenAIInstructions(agentSettings);
    console.log('[OpenAI] ✅ instructions生成成功');
    console.log('[OpenAI] instructions長さ:', instructions.length);
    console.log('[OpenAI] instructions冒頭200文字:', instructions.substring(0, 200));
    console.log('[OpenAI] 会社名チェック:', instructions.includes(agentSettings.conversationSettings.companyName) ? '✅含まれる' : '❌含まれない');
    console.log('[OpenAI] サービス名チェック:', instructions.includes(agentSettings.conversationSettings.serviceName) ? '✅含まれる' : '❌含まれない');
  } catch (error) {
    console.error('[OpenAI] ❌ instructions生成失敗:', error);
    // Fallback to simple instructions
    instructions = "You are a helpful AI assistant for making business calls.";
  }

  const temperature = agentSettings?.temperature || 0.8;

  // Use SIMPLE API format (matching working simple version)
  const sessionUpdate = {
    type: "session.update",
    session: {
      type: "realtime",  // ← シンプル版と同じ
      model: "gpt-realtime",  // ← シンプル版と同じ
      output_modalities: ["audio"],  // ← シンプル版と同じ
      audio: {  // ← ネスト構造（シンプル版と同じ）
        input: {
          format: { type: "audio/pcmu" },
          turn_detection: { type: "server_vad" },
          transcription: { model: "whisper-1" }  // ← ユーザー発話をテキスト化
        },
        output: {
          format: { type: "audio/pcmu" },
          voice: agentSettings?.voice || "alloy"
        }
      },
      instructions: instructions,
      // temperature is passed in URL for simple version
      // Function calling for automatic handoff
      tools: [
        {
          type: "function",
          name: "transfer_to_human",
          description: "顧客が営業担当との会話を承諾した時、人間の営業担当に電話転送する。顧客が「はい」「お願いします」「聞きます」などポジティブに応答し、転送準備が整った時のみ呼び出す。重要：顧客が明確に同意した時のみ使用すること。",
          parameters: {
            type: "object",
            properties: {
              customer_consent: {
                type: "boolean",
                description: "顧客が転送に明確に同意したか（true=同意、false=拒否）"
              },
              reason: {
                type: "string",
                description: "転送理由（例：詳細説明希望、価格質問、技術的質問、担当者希望）",
                enum: ["詳細説明希望", "価格質問", "技術的質問", "担当者希望", "その他"]
              }
            },
            required: ["customer_consent"]
          }
        },
        {
          type: "function",
          name: "end_call_on_rejection",
          description: "顧客が明確に興味がないと表明し、会話の継続を拒否した時に使用する。「結構です」「必要ありません」「忙しいので」「間に合っています」などの明確な拒否表現を検知した時のみ呼び出す。重要：顧客が明確に拒否した時のみ使用すること。",
          parameters: {
            type: "object",
            properties: {
              rejection_reason: {
                type: "string",
                description: "顧客の拒否理由カテゴリ",
                enum: ["興味なし", "忙しい", "既存サービス利用中", "不要", "その他"]
              }
            },
            required: ["rejection_reason"]
          }
        },
        {
          type: "function",
          name: "end_call_on_voicemail",
          description: "留守番電話に転送されたことを検知した時に使用する。「留守番電話に転送されました」「発信音の後で」「メッセージを録音」などのキーワードを検知した時、または機械的な音声アナウンスを検知した時に呼び出す。簡潔なメッセージを残した後、この関数を呼び出して通話を終了する。",
          parameters: {
            type: "object",
            properties: {
              voicemail_detected: {
                type: "boolean",
                description: "留守番電話が検出されたか"
              }
            },
            required: ["voicemail_detected"]
          }
        }
      ],
      tool_choice: "auto"  // AIが自動的に判断して関数を呼び出す
    }
  };

  console.log('[OpenAI] Sending session update with instructions preview:',
    instructions.substring(0, 200) + '...');
  openaiWs.send(JSON.stringify(sessionUpdate));
}

/**
 * Send mark event to Twilio for response tracking
 * Reference: official sample line 178-186
 */
function sendMark(twilioWs, streamSid, markQueue) {
  if (!streamSid) {
    console.warn('[Mark] Skipped: streamSid is null');
    return;
  }

  if (!twilioWs || twilioWs.readyState !== WebSocket.OPEN) {
    console.error('[Mark] ERROR: Twilio WebSocket not open. State:', twilioWs?.readyState);
    return;
  }

  const markEvent = {
    event: "mark",
    streamSid: streamSid,
    mark: { name: "responsePart" }
  };

  try {
    twilioWs.send(JSON.stringify(markEvent));
    markQueue.push('responsePart');
  } catch (error) {
    console.error('[Mark] ERROR sending mark:', error.message);
  }
}

/**
 * Handle WebSocket connection for Twilio Media Streams
 * Reference: official sample line 62-188
 *
 * @param {WebSocket} twilioWs - WebSocket connection from Twilio Media Streams
 * @param {Express.Request} req - Express request object containing callId in params
 */
exports.handleMediaStream = async (twilioWs, req) => {
  const callId = req.params.callId;
  console.log('[MediaStream] Client connected, callId:', callId);

  // Validate OpenAI API key (matching Python sample line 34-35)
  if (!process.env.OPENAI_REALTIME_API_KEY) {
    console.error('[MediaStream] Missing OpenAI API key');
    twilioWs.close();
    return;
  }

  // Connection state variables (official sample line 76-81)
  let streamSid = null;
  let latestMediaTimestamp = 0;
  let lastAssistantItem = null;
  let markQueue = [];
  let responseStartTimestamp = null;
  let openaiWs = null;

  // Auto handoff state - store function call info to execute after AI finishes speaking
  let pendingHandoff = null;

  // Auto call end state - store function call info to execute after AI finishes speaking
  let pendingCallEnd = null;

  // CallSession reference (will be loaded later)
  let callSession = null;

  // ========================================
  // Register Twilio WebSocket handlers IMMEDIATELY
  // This ensures we don't miss 'connected' and 'start' events
  // ========================================

  // Receive messages from Twilio → Send to OpenAI
  // Reference: official sample line 83-108
  twilioWs.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('[Twilio→Backend] Received message:', JSON.stringify(data).substring(0, 200), 'callId:', callId);
      console.log('[Twilio→Backend] Event type:', data.event || 'NO EVENT FIELD');

      // Handle media event (official sample line 89-95)
      if (data.event === 'media' && openaiWs && openaiWs.readyState === WebSocket.OPEN) {
        latestMediaTimestamp = parseInt(data.media.timestamp);
        const audioAppend = {
          type: "input_audio_buffer.append",
          audio: data.media.payload  // ← Already base64-encoded μ-law, send as-is
        };
        openaiWs.send(JSON.stringify(audioAppend));
      }

      // Handle stream start (official sample line 96-101)
      else if (data.event === 'start') {
        streamSid = data.start.streamSid;
        console.log('[MediaStream] Stream started:', streamSid);
        responseStartTimestamp = null;
        latestMediaTimestamp = 0;
        lastAssistantItem = null;

        // Update streamSid in global map
        const connection = global.activeMediaStreams.get(callId);
        if (connection) {
          connection.streamSid = streamSid;
          console.log('[MediaStream] Updated streamSid in global map:', callId);
        }

        // Note: callStatusUpdate 'calling' is now sent in openaiWs.on('open') handler
        // to avoid race condition where this 'start' event arrives before callSession is loaded
      }

      // Handle mark confirmation (official sample line 102-104)
      else if (data.event === 'mark') {
        if (markQueue.length > 0) {
          markQueue.shift();  // Remove first mark
        }
      }

    } catch (error) {
      console.error('[MediaStream] Error processing Twilio message:', error.message);
    }
  });

  // Handle Twilio WebSocket close
  twilioWs.on('close', async () => {
    console.log('[MediaStream] Client disconnected');

    // Remove from global map
    if (global.activeMediaStreams.has(callId)) {
      global.activeMediaStreams.delete(callId);
      console.log('[MediaStream] Removed connection from global map:', callId);
    }

    // Close OpenAI connection
    if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
      openaiWs.close();
    }

    // Update CallSession and save transcript to DB
    if (callSession) {
      callSession.status = 'completed';

      // トランスクリプトをDBに一括保存（通話終了時のみ）
      if (callSession.transcript && callSession.transcript.length > 0) {
        console.log('[MediaStream] Saving transcript to DB:', {
          callId: callSession._id.toString(),
          transcriptLength: callSession.transcript.length
        });
      }

      await callSession.save();
      console.log('[MediaStream] CallSession saved with transcript');

      // Notify frontend via WebSocket - call ended
      if (global.io) {
        const eventData = {
          customerId: callSession.customerId?.toString() || callSession.customerId,
          phoneNumber: callSession.phoneNumber,
          status: 'completed',
          callResult: callSession.callResult || '完了',
          callId: callSession._id.toString(),
          twilioCallSid: callSession.twilioCallSid
        };
        global.io.emit('callStatusUpdate', eventData);
        console.log('[WebSocket] Emitted callStatusUpdate: completed', JSON.stringify(eventData));
      }
    }
  });

  // Handle Twilio WebSocket errors
  twilioWs.on('error', (error) => {
    console.error('[MediaStream] Twilio WebSocket error:', error.message);
  });

  try {
    // Load CallSession from database
    callSession = await CallSession.findById(callId).populate('assignedAgent');

    if (!callSession) {
      console.error('[MediaStream] CallSession not found:', callId);
      twilioWs.close();
      return;
    }

    console.log('[MediaStream] CallSession loaded:', callSession._id);

    // Load AgentSettings
    let agentSettings = null;
    if (callSession.assignedAgent) {
      agentSettings = await AgentSettings.findOne({ userId: callSession.assignedAgent._id });
      console.log('[MediaStream] AgentSettings loaded for user:', callSession.assignedAgent._id);
      if (agentSettings && agentSettings.conversationSettings) {
        console.log('[MediaStream] AgentSettings preview:', {
          companyName: agentSettings.conversationSettings.companyName,
          serviceName: agentSettings.conversationSettings.serviceName,
          representativeName: agentSettings.conversationSettings.representativeName
        });
      } else {
        console.warn('[MediaStream] AgentSettings missing conversationSettings!');
      }
    }

    // Connect to OpenAI Realtime API (SIMPLE VERSION format)
    const temperature = agentSettings?.temperature || 0.8;
    const openaiUrl = `wss://api.openai.com/v1/realtime?model=gpt-realtime&temperature=${temperature}`;
    console.log('[OpenAI] Connecting to:', openaiUrl);
    console.log('[OpenAI] Using temperature:', temperature);
    console.log('[OpenAI] API Key present:', !!process.env.OPENAI_REALTIME_API_KEY);
    console.log('[OpenAI] API Key prefix:', process.env.OPENAI_REALTIME_API_KEY?.substring(0, 10) + '...');

    openaiWs = new WebSocket(openaiUrl, {
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_REALTIME_API_KEY}`
        // NO OpenAI-Beta header - Simple version doesn't use it
      }
    });

    // Handle OpenAI WebSocket connection open
    openaiWs.on('open', async () => {
      console.log('[OpenAI] Connected to Realtime API');

      // Initialize session (official sample line 74)
      await initializeSession(openaiWs, agentSettings);

      // Update CallSession
      callSession.realtimeSessionId = 'session-' + Date.now();
      await callSession.save();

      // Notify frontend via WebSocket - call started (calling status)
      // This is sent here to avoid race condition where 'start' event arrives before callSession is loaded
      if (global.io) {
        const eventData = {
          customerId: callSession.customerId?.toString() || callSession.customerId,
          phoneNumber: callSession.phoneNumber,
          status: 'calling',
          callId: callSession._id.toString(),
          twilioCallSid: callSession.twilioCallSid
        };
        global.io.emit('callStatusUpdate', eventData);
        console.log('[WebSocket] Emitted callStatusUpdate: calling', JSON.stringify(eventData));
      }

      // Register connection in global map for handoff support
      global.activeMediaStreams.set(callId, {
        twilioWs,
        openaiWs,
        streamSid: null // Will be set when 'start' event is received
      });
      console.log('[MediaStream] Registered connection in global map:', callId);
    });

    // Handle OpenAI WebSocket errors
    openaiWs.on('error', (error) => {
      console.error('[OpenAI] WebSocket error:', error.message);
      console.error('[OpenAI] Error details:', error);

      // Close Twilio connection on OpenAI error
      if (twilioWs && twilioWs.readyState === 1) { // 1 = OPEN
        twilioWs.close();
      }
    });

    // Handle OpenAI WebSocket close
    openaiWs.on('close', (code, reason) => {
      console.log('[OpenAI] WebSocket closed, code:', code, 'reason:', reason?.toString());

      // Close Twilio connection when OpenAI closes
      if (twilioWs && twilioWs.readyState === 1) { // 1 = OPEN
        twilioWs.close();
      }
    });

    // Receive messages from OpenAI → Send to Twilio
    // Reference: official sample line 110-146
    openaiWs.on('message', async (data) => {
      try {
        const response = JSON.parse(data.toString());

        // TEMPORARY DEBUG: Log ALL event types to identify function calling events
        if (response.type && response.type.includes('function') || response.type && response.type.includes('output_item')) {
          console.log('[OpenAI DEBUG] Event type:', response.type);
          console.log('[OpenAI DEBUG] Full response:', JSON.stringify(response, null, 2));
        }

        // Log important events (official sample line 116-117)
        if (LOG_EVENT_TYPES.includes(response.type)) {
          console.log('[OpenAI] Event:', response.type, response);
        }

        // Handle audio delta from OpenAI (official sample line 119-128)
        if (response.type === 'response.output_audio.delta' && response.delta) {
          // Verify Twilio WebSocket is ready
          if (!twilioWs) {
            console.error('[Audio] ERROR: twilioWs is null/undefined');
            return;
          }

          if (twilioWs.readyState !== WebSocket.OPEN) {
            console.error('[Audio] ERROR: Twilio WebSocket not open. State:', twilioWs.readyState);
            console.error('[Audio] States: 0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED');
            return;
          }

          if (!streamSid) {
            console.error('[Audio] ERROR: streamSid is null - stream not initialized');
            return;
          }

          const audioPayload = Buffer.from(
            Buffer.from(response.delta, 'base64')
          ).toString('base64');  // Re-encode (official sample line 120)

          const audioEvent = {
            event: "media",
            streamSid: streamSid,
            media: {
              payload: audioPayload
            }
          };

          try {
            twilioWs.send(JSON.stringify(audioEvent));
            console.log('[Audio] ✓ Sent audio chunk to Twilio, size:', audioPayload.length);
          } catch (error) {
            console.error('[Audio] ERROR sending to Twilio:', error.message);
            console.error('[Audio] WebSocket state:', twilioWs.readyState);
          }

          // Track response timing (official sample line 131-136)
          if (response.item_id && response.item_id !== lastAssistantItem) {
            responseStartTimestamp = latestMediaTimestamp;
            lastAssistantItem = response.item_id;
            console.log('[Audio] New assistant item:', response.item_id);

            // Notify frontend via WebSocket - AI is responding
            if (callSession && global.io) {
              const eventData = {
                customerId: callSession.customerId?.toString() || callSession.customerId,
                phoneNumber: callSession.phoneNumber,
                status: 'ai-responding',
                callId: callSession._id.toString(),
                twilioCallSid: callSession.twilioCallSid
              };
              global.io.emit('callStatusUpdate', eventData);
              console.log('[WebSocket] Emitted callStatusUpdate: ai-responding', JSON.stringify(eventData));
            }
          }

          // Send mark for tracking (official sample line 137)
          sendMark(twilioWs, streamSid, markQueue);
        }

        // Handle user speech start - trigger interruption (official sample line 140-144)
        if (response.type === 'input_audio_buffer.speech_started') {
          console.log('[Interrupt] Speech started detected');

          if (lastAssistantItem && markQueue.length > 0 && responseStartTimestamp !== null) {
            // Handle interruption (official sample line 148-176)
            await handleSpeechStarted(
              twilioWs,
              openaiWs,
              streamSid,
              latestMediaTimestamp,
              responseStartTimestamp,
              lastAssistantItem,
              markQueue
            );

            // Reset state
            markQueue.length = 0;
            lastAssistantItem = null;
            responseStartTimestamp = null;
          }
        }

        // Save user input from input_audio_buffer.committed event
        if (response.type === 'input_audio_buffer.committed' && response.item_id) {
          // User speech was committed - save as user message
          // Note: Transcript not available yet, will be updated when response includes it
          console.log('[Conversation] User speech committed:', response.item_id);
        }

        // Handle user speech transcription
        if (response.type === 'conversation.item.input_audio_transcription.completed') {
          const transcript = response.transcript;
          const itemId = response.item_id;

          console.log('[User Transcription] Completed:', {
            itemId: itemId,
            transcript: transcript
          });

          if (transcript && transcript.length > 0) {
            // Save user speech to realtimeConversation
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

            // Send via WebSocket
            sendConversationUpdate(callSession, 'user', transcript);
          }
        }

        // Save conversation from conversation.item.created event (includes both user and assistant)
        if (response.type === 'conversation.item.created' && response.item) {
          const item = response.item;
          console.log('[Conversation] Item created:', {
            id: item.id,
            type: item.type,
            role: item.role,
            hasContent: !!item.content
          });

          // Save items with content (user or assistant messages)
          if (item.role && item.content && item.content.length > 0) {
            callSession.realtimeConversation.push({
              type: item.type || 'message',
              role: item.role,
              content: item.content,
              timestamp: new Date()
            });

            await callSession.save();
            console.log('[Conversation] Saved item (conversation.item.created), role:', item.role, 'total:', callSession.realtimeConversation.length);
          }
        }

        // Save conversation items to database from response.done event
        if (response.type === 'response.done' && response.response) {
          const resp = response.response;

          // Save each output item from the response (assistant messages)
          if (resp.output && resp.output.length > 0) {
            for (const item of resp.output) {
              if (item.role && item.content) {
                console.log('[Conversation] Saving assistant item:', {
                  role: item.role,
                  contentLength: item.content.length,
                  type: item.type
                });

                callSession.realtimeConversation.push({
                  type: item.type || 'message',
                  role: item.role,
                  content: item.content,  // Store as array
                  timestamp: new Date()
                });

                // Extract text and send via WebSocket
                const text = extractTextFromContent(item.content);
                console.log('[Conversation] Extracted text:', text || '(empty)', 'from content types:', item.content.map(c => c.type).join(', '));
                if (text) {
                  sendConversationUpdate(callSession, item.role, text);
                }
              }
            }

            await callSession.save();
            console.log('[Conversation] Saved to database, total items:', callSession.realtimeConversation.length);
          }

          // Execute pending handoff AFTER AI finishes speaking
          if (pendingHandoff) {
            console.log('[AutoHandoff] AI response completed, waiting for audio playback to finish');
            console.log('[AutoHandoff] Pending handoff data:', pendingHandoff);

            // Store reference and clear immediately to prevent duplicate execution
            const handoffData = pendingHandoff;
            pendingHandoff = null;

            // Wait 5 seconds to ensure AI's full handoff message completes
            // "それでは担当者におつなぎいたします。よろしくお願いいたします。"
            // This accounts for:
            // - Network latency between OpenAI → Twilio → Customer
            // - Audio playback duration for the longer handoff message
            // - Audio buffering on customer's device
            // - Natural pause before transfer
            setTimeout(async () => {
              try {
                console.log('[AutoHandoff] Audio playback buffer complete, executing handoff now');
                const result = await executeAutoHandoff(callSession, handoffData.callId, handoffData.args);
                console.log('[AutoHandoff] Successfully executed after AI response:', result);
              } catch (error) {
                console.error('[AutoHandoff] Error executing pending handoff:', error);
              }
            }, 5000);  // 5 second delay
          }

          // Execute pending call end AFTER AI finishes speaking
          if (pendingCallEnd) {
            console.log('[AutoCallEnd] AI応答完了、音声再生完了後に切電を実行');
            console.log('[AutoCallEnd] Pending call end data:', pendingCallEnd);

            // Store reference and clear immediately to prevent duplicate execution
            const callEndData = pendingCallEnd;
            pendingCallEnd = null;

            // Wait 8 seconds to ensure AI's farewell message completes
            // "承知いたしました。お忙しいところ失礼いたしました。失礼いたします。"
            // This accounts for:
            // - AI response generation time
            // - Network latency between OpenAI → Twilio → Customer
            // - Audio playback duration for the farewell message (~7 seconds)
            // - Audio buffering on customer's device
            setTimeout(async () => {
              try {
                console.log('[AutoCallEnd] 音声再生バッファ完了、切電を実行します');
                const result = await executeAutoCallEnd(callSession, callEndData.callId, callEndData.args);
                console.log('[AutoCallEnd] 切電実行完了:', result);
              } catch (error) {
                console.error('[AutoCallEnd] 切電実行エラー:', error);
              }
            }, 8000);  // 8 second delay
          }
        }

        // Handle Function Calling - Auto Handoff
        if (response.type === 'response.output_item.done' && response.item) {
          const item = response.item;
          console.log('[FunctionCall] Detected output_item.done:', item.type);

          if (item.type === 'function_call' && item.name === 'transfer_to_human') {
            console.log('[FunctionCall] Transfer function called by AI');
            console.log('[FunctionCall] Arguments:', item.arguments);
            console.log('[FunctionCall] Storing for execution after AI response completes');

            // Store function call info to execute AFTER AI finishes speaking
            try {
              const args = JSON.parse(item.arguments);
              pendingHandoff = {
                callId: item.call_id,
                args: args
              };

              // Send success result back to OpenAI immediately so it can generate response
              if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
                const functionOutput = {
                  type: 'conversation.item.create',
                  item: {
                    type: 'function_call_output',
                    call_id: item.call_id,
                    output: JSON.stringify({
                      success: true,
                      message: '転送準備が整いました。お客様にご案内後、転送を実行します。'
                    })
                  }
                };
                openaiWs.send(JSON.stringify(functionOutput));
                console.log('[FunctionCall] Sent function result to OpenAI (handoff pending)');

                // Request AI to generate response
                const responseCreate = {
                  type: 'response.create'
                };
                openaiWs.send(JSON.stringify(responseCreate));
              }
            } catch (error) {
              console.error('[FunctionCall] Error parsing function arguments:', error);
              pendingHandoff = null;

              // Send error back to OpenAI
              if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
                const functionOutput = {
                  type: 'conversation.item.create',
                  item: {
                    type: 'function_call_output',
                    call_id: item.call_id,
                    output: JSON.stringify({
                      success: false,
                      message: '転送準備に失敗しました',
                      error: error.message
                    })
                  }
                };
                openaiWs.send(JSON.stringify(functionOutput));
              }
            }
          }

          // Handle Function Calling - Auto Call End on Rejection
          else if (item.type === 'function_call' && item.name === 'end_call_on_rejection') {
            console.log('[FunctionCall] 顧客拒否検知 - 切電処理を予約');
            console.log('[FunctionCall] Arguments:', item.arguments);
            console.log('[FunctionCall] AI応答完了後に切電を実行します');

            try {
              const args = JSON.parse(item.arguments);
              pendingCallEnd = {
                callId: item.call_id,
                args: args,
                type: 'rejection'
              };

              // OpenAIに成功結果を返す（AIが丁寧な挨拶を生成できるように）
              if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
                const functionOutput = {
                  type: 'conversation.item.create',
                  item: {
                    type: 'function_call_output',
                    call_id: item.call_id,
                    output: JSON.stringify({
                      success: true,
                      message: '切電準備が整いました。お客様にご挨拶後、通話を終了します。'
                    })
                  }
                };
                openaiWs.send(JSON.stringify(functionOutput));
                console.log('[FunctionCall] Sent function result to OpenAI (call end pending)');

                // AI応答生成をリクエスト
                const responseCreate = {
                  type: 'response.create'
                };
                openaiWs.send(JSON.stringify(responseCreate));
              }
            } catch (error) {
              console.error('[FunctionCall] Error parsing function arguments:', error);
              pendingCallEnd = null;

              // エラー結果をOpenAIに返す
              if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
                const functionOutput = {
                  type: 'conversation.item.create',
                  item: {
                    type: 'function_call_output',
                    call_id: item.call_id,
                    output: JSON.stringify({
                      success: false,
                      message: '切電準備に失敗しました',
                      error: error.message
                    })
                  }
                };
                openaiWs.send(JSON.stringify(functionOutput));
              }
            }
          }

          // Handle Function Calling - Auto Call End on Voicemail
          else if (item.type === 'function_call' && item.name === 'end_call_on_voicemail') {
            console.log('[FunctionCall] 留守番電話検知 - 切電処理を予約');
            console.log('[FunctionCall] Arguments:', item.arguments);
            console.log('[FunctionCall] メッセージ完了後に切電を実行します');

            try {
              const args = JSON.parse(item.arguments);
              pendingCallEnd = {
                callId: item.call_id,
                args: args,
                type: 'voicemail'
              };

              // OpenAIに成功結果を返す（AIがメッセージを残せるように）
              if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
                const functionOutput = {
                  type: 'conversation.item.create',
                  item: {
                    type: 'function_call_output',
                    call_id: item.call_id,
                    output: JSON.stringify({
                      success: true,
                      message: '留守番電話を検出しました。メッセージを残した後、通話を終了します。'
                    })
                  }
                };
                openaiWs.send(JSON.stringify(functionOutput));
                console.log('[FunctionCall] Sent function result to OpenAI (voicemail end pending)');

                // AI応答生成をリクエスト
                const responseCreate = {
                  type: 'response.create'
                };
                openaiWs.send(JSON.stringify(responseCreate));
              }
            } catch (error) {
              console.error('[FunctionCall] Error parsing voicemail function arguments:', error);
              pendingCallEnd = null;

              // エラー結果をOpenAIに返す
              if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
                const functionOutput = {
                  type: 'conversation.item.create',
                  item: {
                    type: 'function_call_output',
                    call_id: item.call_id,
                    output: JSON.stringify({
                      success: false,
                      message: '切電準備に失敗しました',
                      error: error.message
                    })
                  }
                };
                openaiWs.send(JSON.stringify(functionOutput));
              }
            }
          }
        }

      } catch (error) {
        console.error('[OpenAI] Error processing message:', error.message);
      }
    });

    // Twilio event handlers are registered at the top of this function

  } catch (error) {
    console.error('[MediaStream] Error in handleMediaStream:', error.message);
    console.error('[MediaStream] Stack:', error.stack);

    // Close connections
    if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
      openaiWs.close();
    }
    twilioWs.close();
  }
};

/**
 * Handle speech started event - interrupt AI response
 * Reference: official sample line 148-176
 */
async function handleSpeechStarted(
  twilioWs,
  openaiWs,
  streamSid,
  latestMediaTimestamp,
  responseStartTimestamp,
  lastAssistantItem,
  markQueue
) {
  console.log('[Interrupt] Handling speech started event');

  if (markQueue.length > 0 && responseStartTimestamp !== null) {
    const elapsedTime = latestMediaTimestamp - responseStartTimestamp;
    console.log('[Interrupt] Elapsed time:', elapsedTime, 'ms');

    if (lastAssistantItem) {
      // Send truncate command to OpenAI (official sample line 161-167)
      if (openaiWs && openaiWs.readyState === WebSocket.OPEN) {
        const truncateEvent = {
          type: "conversation.item.truncate",
          item_id: lastAssistantItem,
          content_index: 0,
          audio_end_ms: elapsedTime
        };
        try {
          openaiWs.send(JSON.stringify(truncateEvent));
          console.log('[Interrupt] ✓ Sent truncate to OpenAI');
        } catch (error) {
          console.error('[Interrupt] ERROR sending truncate:', error.message);
        }
      } else {
        console.error('[Interrupt] ERROR: OpenAI WebSocket not open');
      }
    }

    // Clear Twilio buffer (official sample line 169-172)
    if (twilioWs && twilioWs.readyState === WebSocket.OPEN) {
      try {
        twilioWs.send(JSON.stringify({
          event: "clear",
          streamSid: streamSid
        }));
        console.log('[Interrupt] ✓ Cleared Twilio buffer');
      } catch (error) {
        console.error('[Interrupt] ERROR clearing Twilio buffer:', error.message);
      }
    } else {
      console.error('[Interrupt] ERROR: Twilio WebSocket not open');
    }
  }
}

module.exports = exports;
