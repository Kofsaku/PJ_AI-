import { NextResponse, NextRequest } from 'next/server'

// Node.js Runtime指定（Vercel Edge Runtime回避）
export const runtime = 'nodejs'

// 共通のモデル定義とヘルパー関数
async function initializeMongoose() {
  const mongoose = require('mongoose')

  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://kosakutsubata:f10Kl6uGREjqHoWh@cluster0.cu3zvlo.mongodb.net/ai-call?retryWrites=true&w=majority&appName=Cluster0')
  }
  return mongoose
}

function defineModels(mongoose) {
  // Userモデル定義
  const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    companyId: String,
    role: { type: String, default: 'user' }
  })
  const User = mongoose.models.User || mongoose.model('User', UserSchema)

  // CallSessionモデル定義
  const VALID_STATUS = ['initiating', 'queued', 'calling', 'initiated', 'ai-responding', 'transferring', 'human-connected', 'in-progress', 'completed', 'failed', 'cancelled']
  const VALID_END_REASON = ['completed', 'cancelled', 'failed', 'no-answer', 'busy', 'customer-hangup', 'agent-hangup', 'timeout', 'system-error']
  const VALID_CALL_RESULT = ['成功', '不在', '拒否', '要フォロー', '失敗', '通話中', '未対応']

  const CallSessionSchema = new mongoose.Schema({
    companyId: {
      type: String,
      required: true,
      index: true
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: false
    },
    phoneNumber: {
      type: String,
      required: false
    },
    twilioCallSid: {
      type: String,
      required: false,
      unique: true,
      sparse: true
    },
    conferenceSid: {
      type: String,
      sparse: true
    },
    status: {
      type: String,
      enum: {
        values: VALID_STATUS,
        message: 'Invalid status value: {VALUE}. Must be one of: ' + VALID_STATUS.join(', ')
      },
      default: 'initiating'
    },
    error: {
      type: String,
      required: false
    },
    startTime: {
      type: Date,
      default: Date.now
    },
    endTime: Date,
    endReason: {
      type: String,
      enum: {
        values: VALID_END_REASON,
        message: 'Invalid endReason value: {VALUE}. Must be one of: ' + VALID_END_REASON.join(', ')
      },
      required: false
    },
    assignedAgent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    transcript: [{
      timestamp: {
        type: Date,
        default: Date.now
      },
      speaker: {
        type: String,
        enum: ['ai', 'customer', 'agent']
      },
      message: String,
      confidence: Number
    }],
    handoffTime: Date,
    handoffReason: String,
    handoffDetails: {
      requestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      requestedAt: Date,
      connectedAt: Date,
      disconnectedAt: Date,
      handoffPhoneNumber: String,
      handoffCallSid: String,
      handoffMethod: {
        type: String,
        enum: ['manual', 'auto', 'ai-triggered'],
        default: 'manual'
      }
    },
    participants: [{
      type: {
        type: String,
        enum: ['customer', 'ai', 'agent']
      },
      callSid: String,
      phoneNumber: String,
      joinedAt: Date,
      leftAt: Date,
      isMuted: Boolean,
      isOnHold: Boolean
    }],
    recordingSettings: {
      enabled: { type: Boolean, default: true },
      retentionDays: { type: Number, default: 7 },
      deleteAfter: Date
    },
    callResult: {
      type: String,
      enum: {
        values: VALID_CALL_RESULT,
        message: 'Invalid callResult value: {VALUE}. Must be one of: ' + VALID_CALL_RESULT.join(', ')
      }
    },
    notes: String,
    duration: Number,
    recordingUrl: String,
    twilioRecordingUrl: String,
    recordingSid: String,
    aiConfiguration: {
      companyName: String,
      serviceName: String,
      representativeName: String,
      targetDepartment: String,
      serviceDescription: String,
      targetPerson: String,
      salesPitch: {
        companyDescription: String,
        callToAction: String,
        keyBenefits: [String]
      }
    }
  }, {
    timestamps: true
  })

  CallSessionSchema.index({ customerId: 1, createdAt: -1 })
  CallSessionSchema.index({ assignedAgent: 1, createdAt: -1 })
  CallSessionSchema.index({ status: 1 })
  CallSessionSchema.index({ twilioCallSid: 1 })

  const CallSession = mongoose.models.CallSession || mongoose.model('CallSession', CallSessionSchema)

  return { User, CallSession }
}

// TwiML生成ヘルパー
function generateTwiML(actions) {
  let twiml = '<?xml version="1.0" encoding="UTF-8"?><Response>'

  for (const action of actions) {
    if (action.type === 'say') {
      twiml += `<Say voice="Polly.Mizuki">${action.text}</Say>`
    } else if (action.type === 'gather') {
      twiml += `<Gather input="speech" timeout="${action.timeout || 5}" speechTimeout="${action.speechTimeout || 'auto'}">`
      if (action.say) {
        twiml += `<Say voice="Polly.Mizuki">${action.say}</Say>`
      }
      twiml += '</Gather>'
    } else if (action.type === 'record') {
      twiml += `<Record timeout="${action.timeout || 10}" finishOnKey="#" transcribe="true" />`
    } else if (action.type === 'hangup') {
      twiml += '<Hangup/>'
    }
  }

  twiml += '</Response>'
  return twiml
}

// 通話結果の判定
function determineCallResult(intent, nextAction) {
  console.log(`[CallResult] 判定中 - Intent: ${intent}, NextAction: ${nextAction}`)

  switch (intent) {
    case 'absent':
    case 'not_available':
      return '不在'

    case 'rejection':
    case 'decline':
    case 'refuse':
      return '拒否'

    case 'interest':
    case 'positive_response':
    case 'agreement':
    case 'website_redirect':
    case 'information_provided':
      return '成功'

    case 'needs_followup':
    case 'callback_request':
    case 'partial_interest':
      return '要フォロー'

    case 'error':
    case 'system_error':
    case 'network_issue':
      return '失敗'

    default:
      if (nextAction === 'respond_and_end' || nextAction === 'end_call') {
        return '成功'
      } else if (nextAction === 'apologize_and_end') {
        return '要フォロー'
      } else {
        return '成功'
      }
  }
}

// GET: Twilio Voice Webhook入り口
export async function GET(request: NextRequest) {
  try {
    console.log('[Twilio Voice API] GET request received')

    // 基本的なTwiMLレスポンス
    const twiml = generateTwiML([
      { type: 'say', text: 'お電話ありがとうございます。AIコールシステムです。' },
      { type: 'gather', say: 'ご用件をお聞かせください。', timeout: 10 }
    ])

    return new NextResponse(twiml, {
      status: 200,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
      },
    })

  } catch (error) {
    console.error('[Twilio Voice API] GET Error:', error)

    const errorTwiml = generateTwiML([
      { type: 'say', text: 'システムエラーが発生しました。申し訳ございません。' },
      { type: 'hangup' }
    ])

    return new NextResponse(errorTwiml, {
      status: 200,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
      },
    })
  }
}

// POST: Twilio Voice Webhook処理
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const body = Object.fromEntries(formData)

    console.log('[Twilio Voice API] POST request received:', {
      CallSid: body.CallSid,
      CallStatus: body.CallStatus,
      From: body.From,
      To: body.To,
      SpeechResult: body.SpeechResult
    })

    const mongoose = await initializeMongoose()
    const { CallSession } = defineModels(mongoose)

    // CallSessionを取得または作成
    let callSession = null
    if (body.CallSid) {
      callSession = await CallSession.findOne({ twilioCallSid: body.CallSid })

      if (!callSession) {
        console.log('[Twilio Voice API] Creating new CallSession for Twilio callback')
        callSession = new CallSession({
          twilioCallSid: body.CallSid,
          phoneNumber: body.From,
          status: 'initiated',
          companyId: 'default', // Twilioからの直接コールの場合
          startTime: new Date()
        })
        await callSession.save()
      }
    }

    // 音声入力がある場合の処理
    if (body.SpeechResult) {
      console.log('[Twilio Voice API] Processing speech:', body.SpeechResult)

      // トランスクリプトを記録
      if (callSession) {
        callSession.transcript.push({
          timestamp: new Date(),
          speaker: 'customer',
          message: body.SpeechResult,
          confidence: parseFloat(body.Confidence) || 0.8
        })

        // 簡単な意図分類
        const speechLower = body.SpeechResult.toLowerCase()
        let intent = 'unknown'
        let nextAction = 'continue'

        if (speechLower.includes('いません') || speechLower.includes('不在')) {
          intent = 'absent'
          nextAction = 'end_call'
        } else if (speechLower.includes('結構') || speechLower.includes('いりません')) {
          intent = 'rejection'
          nextAction = 'end_call'
        } else if (speechLower.includes('はい') || speechLower.includes('興味')) {
          intent = 'interest'
          nextAction = 'continue'
        } else if (speechLower.includes('後で') || speechLower.includes('今度')) {
          intent = 'needs_followup'
          nextAction = 'end_call'
        }

        // 通話結果を設定
        const callResult = determineCallResult(intent, nextAction)
        callSession.callResult = callResult

        // ステータス更新
        if (nextAction === 'end_call') {
          callSession.status = 'completed'
          callSession.endTime = new Date()
          callSession.endReason = 'completed'
        } else {
          callSession.status = 'ai-responding'
        }

        await callSession.save()
        console.log(`[Twilio Voice API] Updated session with result: ${callResult}`)
      }

      // 応答TwiML生成
      let responseTwiml
      if (body.SpeechResult.toLowerCase().includes('いません')) {
        responseTwiml = generateTwiML([
          { type: 'say', text: '承知しました。また改めてお電話いたします。ありがとうございました。' },
          { type: 'hangup' }
        ])
      } else if (body.SpeechResult.toLowerCase().includes('結構')) {
        responseTwiml = generateTwiML([
          { type: 'say', text: '承知しました。ご多忙のところ申し訳ございません。失礼いたします。' },
          { type: 'hangup' }
        ])
      } else {
        responseTwiml = generateTwiML([
          { type: 'say', text: 'ありがとうございます。弊社のサービスについてご案内させていただきます。' },
          { type: 'gather', say: 'ご質問はございますか？', timeout: 10 }
        ])
      }

      return new NextResponse(responseTwiml, {
        status: 200,
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
        },
      })
    }

    // ステータス更新処理
    if (body.CallStatus && callSession) {
      const statusMapping = {
        'initiated': 'initiated',
        'ringing': 'calling',
        'in-progress': 'in-progress',
        'completed': 'completed',
        'busy': 'failed',
        'no-answer': 'failed',
        'failed': 'failed',
        'canceled': 'cancelled'
      }

      const mappedStatus = statusMapping[body.CallStatus] || callSession.status
      callSession.status = mappedStatus

      if (['completed', 'failed', 'cancelled'].includes(mappedStatus)) {
        callSession.endTime = new Date()
        if (!callSession.callResult) {
          callSession.callResult = mappedStatus === 'completed' ? '成功' : '失敗'
        }
      }

      await callSession.save()
      console.log(`[Twilio Voice API] Updated call status: ${body.CallStatus} -> ${mappedStatus}`)
    }

    // デフォルトのTwiMLレスポンス
    const defaultTwiml = generateTwiML([
      { type: 'say', text: 'お世話になります。AIコールシステムからご連絡いたしました。' },
      { type: 'gather', say: 'ご担当者様はいらっしゃいますでしょうか？', timeout: 10 }
    ])

    return new NextResponse(defaultTwiml, {
      status: 200,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
      },
    })

  } catch (error) {
    console.error('[Twilio Voice API] POST Error:', error)

    const errorTwiml = generateTwiML([
      { type: 'say', text: 'システムエラーが発生しました。申し訳ございません。' },
      { type: 'hangup' }
    ])

    return new NextResponse(errorTwiml, {
      status: 200,
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
      },
    })
  }
}

// Handle OPTIONS request for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "*"
    }
  })
}
