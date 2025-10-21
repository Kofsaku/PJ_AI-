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
  'session.updated'
];

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
    console.log('[OpenAI] Generated instructions length:', instructions.length);
  } catch (error) {
    console.error('[OpenAI] Failed to build instructions:', error);
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
          turn_detection: { type: "server_vad" }
        },
        output: {
          format: { type: "audio/pcmu" },
          voice: agentSettings?.voice || "alloy"
        }
      },
      instructions: instructions
      // temperature is passed in URL for simple version
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
  if (streamSid) {
    const markEvent = {
      event: "mark",
      streamSid: streamSid,
      mark: { name: "responsePart" }
    };
    twilioWs.send(JSON.stringify(markEvent));
    markQueue.push('responsePart');
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

        // Log important events (official sample line 116-117)
        if (LOG_EVENT_TYPES.includes(response.type)) {
          console.log('[OpenAI] Event:', response.type, response);
        }

        // Handle audio delta from OpenAI (official sample line 119-128)
        if (response.type === 'response.output_audio.delta' && response.delta) {
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

          twilioWs.send(JSON.stringify(audioEvent));

          // Track response timing (official sample line 131-136)
          if (response.item_id && response.item_id !== lastAssistantItem) {
            responseStartTimestamp = latestMediaTimestamp;
            lastAssistantItem = response.item_id;
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
      const truncateEvent = {
        type: "conversation.item.truncate",
        item_id: lastAssistantItem,
        content_index: 0,
        audio_end_ms: elapsedTime
      };
      openaiWs.send(JSON.stringify(truncateEvent));
      console.log('[Interrupt] Sent truncate to OpenAI');
    }

    // Clear Twilio buffer (official sample line 169-172)
    twilioWs.send(JSON.stringify({
      event: "clear",
      streamSid: streamSid
    }));
    console.log('[Interrupt] Cleared Twilio buffer');
  }
}

module.exports = exports;
