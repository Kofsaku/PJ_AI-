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
 * Send conversation update via WebSocket
 */
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

  try {
    // Load CallSession from database
    const callSession = await CallSession.findById(callId).populate('assignedAgent');

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
                const result = await executeAutoHandoff(callSession, pendingHandoff.callId, pendingHandoff.args);
                console.log('[AutoHandoff] Successfully executed after AI response:', result);
              } catch (error) {
                console.error('[AutoHandoff] Error executing pending handoff:', error);
              } finally {
                // Clear pending handoff regardless of success/failure
                pendingHandoff = null;
              }
            }, 5000);  // 5 second delay
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
        }

      } catch (error) {
        console.error('[OpenAI] Error processing message:', error.message);
      }
    });

    // Receive messages from Twilio → Send to OpenAI
    // Reference: official sample line 83-108
    twilioWs.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        console.log('[Twilio→Backend] Received event:', data.event || 'unknown', 'callId:', callId);

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

      // Update CallSession
      if (callSession) {
        callSession.status = 'completed';
        await callSession.save();
      }
    });

    // Handle Twilio WebSocket errors
    twilioWs.on('error', (error) => {
      console.error('[MediaStream] Twilio WebSocket error:', error.message);
    });

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
