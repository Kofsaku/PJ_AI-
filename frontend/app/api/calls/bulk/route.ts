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

  // Customerモデル定義
  const CustomerSchema = new mongoose.Schema({
    companyId: {
      type: String,
      required: true,
      index: true
    },
    customer: {
      type: String,
      required: true
    },
    date: {
      type: String,
      required: true
    },
    time: {
      type: String,
      required: true
    },
    duration: {
      type: String,
      required: true
    },
    result: {
      type: String,
      required: true
    },
    notes: {
      type: String,
      required: false
    },
    address: {
      type: String,
      required: false
    },
    phone: {
      type: String,
      required: false
    },
    email: {
      type: String,
      required: false
    },
    company: {
      type: String,
      required: false
    }
  }, {
    timestamps: true
  })

  const Customer = mongoose.models.Customer || mongoose.model('Customer', CustomerSchema)

  // CallSessionモデル定義（バックエンドから移植）
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

  const CallSession = mongoose.models.CallSession || mongoose.model('CallSession', CallSessionSchema)

  // AgentSettingsモデル定義
  const AgentSettingsSchema = new mongoose.Schema({
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    phoneNumber: {
      type: String,
      required: false
    },
    isAvailable: {
      type: Boolean,
      default: true
    },
    conversationSettings: {
      companyName: {
        type: String,
        required: true
      },
      serviceName: {
        type: String,
        required: true
      },
      representativeName: {
        type: String,
        required: true
      },
      targetDepartment: {
        type: String,
        required: true,
        default: '営業部'
      },
      salesPitch: {
        companyDescription: {
          type: String,
          default: '弊社では、{{serviceName}}を提供しております。AIが一次架電を行い、見込み度の高いお客様だけを営業におつなぎする仕組みです。'
        },
        serviceDescription: {
          type: String,
          default: '（1）AIが自動で一次架電→要件把握、（2）見込み度スコアで仕分け、（3）高確度のみ人の営業に引き継ぎ、という流れです。架電の無駄を削減し、商談化率の向上に寄与します。'
        },
        keyBenefits: [{
          type: String
        }],
        callToAction: {
          type: String,
          default: 'ぜひ御社の{{targetDepartment}}ご担当者さまに概要をご案内できればと思いまして。'
        }
      },
      serviceDescription: {
        type: String,
        default: '新規テレアポや掘り起こしなどの営業電話を人間に代わって生成AIが電話をかけるというサービスを提供している'
      },
      targetPerson: {
        type: String,
        default: '営業の担当者さま'
      }
    },
    priority: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    }
  }, {
    timestamps: true
  })

  const AgentSettings = mongoose.models.AgentSettings || mongoose.model('AgentSettings', AgentSettingsSchema)

  return { User, Customer, CallSession, AgentSettings }
}

async function authenticateUser(token) {
  if (!token) {
    return null
  }

  const jwt = require('jsonwebtoken')
  const mongoose = await initializeMongoose()
  const { User } = defineModels(mongoose)

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || '7f4a8b9c3d2e1f0g5h6i7j8k9l0m1n2o3p4q5r6s7t8u9v0w1x2y3z4a5b6c7d8e9f')
    const user = await User.findById(decoded.userId || decoded.id)
    return user
  } catch (error) {
    return null
  }
}

// Twilio初期化と通話開始（簡略版）
async function initiateTwilioCall(phoneNumber, callSession) {
  try {
    console.log(`[Twilio Call] Initiating call to ${phoneNumber}`)

    // 電話番号をE.164形式に正規化
    let formattedNumber = phoneNumber.replace(/[^\d+]/g, '')

    // Add country code if not present (assuming Japan)
    if (!formattedNumber.startsWith('+')) {
      if (formattedNumber.startsWith('0')) {
        // Remove leading 0 and add Japan country code
        formattedNumber = '+81' + formattedNumber.substring(1)
      } else if (!formattedNumber.startsWith('81')) {
        formattedNumber = '+81' + formattedNumber
      } else {
        formattedNumber = '+' + formattedNumber
      }
    }

    console.log(`[Twilio Call] Formatted phone number: ${phoneNumber} → ${formattedNumber}`)

    // Twilioクライアント初期化
    const twilio = require('twilio')
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const fromNumber = process.env.TWILIO_PHONE_NUMBER

    if (!accountSid || !authToken || !fromNumber) {
      throw new Error('Twilio credentials not configured')
    }

    const client = twilio(accountSid, authToken)

    // Webhook URLを動的に設定
    const webhookUrl = process.env.TWILIO_WEBHOOK_URL || `${process.env.VERCEL_URL}/api/twilio/voice`

    const call = await client.calls.create({
      url: webhookUrl,
      to: formattedNumber,
      from: fromNumber,
      statusCallback: `${webhookUrl}/status`,
      statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
      statusCallbackMethod: 'POST',
      record: true,
      recordingStatusCallback: `${webhookUrl}/recording`,
      timeout: 30
    })

    console.log(`[Twilio Call] Call created with SID: ${call.sid}`)

    // CallSessionにTwilio SIDを保存
    callSession.twilioCallSid = call.sid
    callSession.status = 'calling'
    await callSession.save()

    return call
  } catch (error) {
    console.error('[Twilio Call] Error:', error)
    callSession.status = 'failed'
    callSession.error = error.message
    callSession.endTime = new Date()
    await callSession.save()
    throw error
  }
}

// POST: 一斉通話開始
export async function POST(request: NextRequest) {
  try {
    const { phoneNumbers, customerIds } = await request.json()
    const token = request.headers.get('authorization')?.replace('Bearer ', '')

    console.log('[Bulk Call API] POST request - phoneNumbers:', phoneNumbers?.length)

    if (!phoneNumbers || phoneNumbers.length === 0) {
      return NextResponse.json(
        { error: 'No phone numbers provided' },
        { status: 400 }
      )
    }

    // 認証
    const user = await authenticateUser(token)
    if (!user) {
      return NextResponse.json(
        { error: 'Not authorized to access this route' },
        { status: 401 }
      )
    }

    console.log('[Bulk Call API] POST request from user:', user.email, 'companyId:', user.companyId)

    const mongoose = await initializeMongoose()
    const { CallSession, AgentSettings } = defineModels(mongoose)

    // エージェント設定を取得
    const agentSettings = await AgentSettings.findOne({ userId: user._id })
    console.log('[Bulk Call API] Agent settings:', agentSettings ? 'found' : 'not found')

    const createdSessions = []

    // 全てのセッションを作成
    for (let i = 0; i < phoneNumbers.length; i++) {
      const phoneNumber = phoneNumbers[i]
      const customerId = customerIds ? customerIds[i] : null

      // セッション作成
      const sessionData = {
        phoneNumber,
        customerId,
        companyId: user.companyId,
        status: 'queued',
        startTime: new Date(),
        assignedAgent: user._id,
      }

      // AI設定を追加
      if (agentSettings?.conversationSettings) {
        sessionData.aiConfiguration = {
          companyName: agentSettings.conversationSettings.companyName,
          serviceName: agentSettings.conversationSettings.serviceName,
          representativeName: agentSettings.conversationSettings.representativeName,
          targetDepartment: agentSettings.conversationSettings.targetDepartment,
          serviceDescription: agentSettings.conversationSettings.serviceDescription,
          targetPerson: agentSettings.conversationSettings.targetPerson,
          salesPitch: agentSettings.conversationSettings.salesPitch
        }
      }

      const callSession = new CallSession(sessionData)
      await callSession.save()
      createdSessions.push(callSession)

      console.log(`[Bulk Call API] Created session ${i + 1}/${phoneNumbers.length}: ${callSession._id}`)
    }

    // 通話を順次開始（バックグラウンドで実行）
    console.log('[Bulk Call API] Starting sequential calls...')

    // バックグラウンドで順次通話処理を開始
    setImmediate(async () => {
      for (const session of createdSessions) {
        try {
          await initiateTwilioCall(session.phoneNumber, session)

          // 次の通話まで3秒間隔を空ける
          await new Promise(resolve => setTimeout(resolve, 3000))
        } catch (error) {
          console.error(`[Bulk Call API] Failed to initiate call for session ${session._id}:`, error)
        }
      }
    })

    // セッション情報を即座に返す
    const responseData = {
      success: true,
      message: `${createdSessions.length} calls queued for processing`,
      sessionIds: createdSessions.map(s => s._id),
      sessions: createdSessions.map(session => ({
        id: session._id,
        phoneNumber: session.phoneNumber,
        status: session.status,
        startTime: session.startTime
      }))
    }

    console.log('[Bulk Call API] Bulk call initiation successful')
    return NextResponse.json(responseData)

  } catch (error) {
    console.error('[Bulk Call API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to initiate bulk calls', details: error.message },
      { status: 500 }
    )
  }
}

// GET: 一斉通話ステータス取得
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const { searchParams } = new URL(request.url)
    const sessionIds = searchParams.get('sessionIds')

    console.log('[Bulk Call API] GET status request - sessionIds:', sessionIds)

    // 認証
    const user = await authenticateUser(token)
    if (!user) {
      return NextResponse.json(
        { error: 'Not authorized to access this route' },
        { status: 401 }
      )
    }

    const mongoose = await initializeMongoose()
    const { CallSession } = defineModels(mongoose)

    let query = { companyId: user.companyId }

    if (sessionIds) {
      const sessionIdArray = sessionIds.split(',')
      query._id = { $in: sessionIdArray }
    }

    const sessions = await CallSession.find(query)
      .populate('customerId', 'customer phone email company')
      .sort({ createdAt: -1 })
      .limit(100)

    const responseData = {
      success: true,
      sessions: sessions.map(session => ({
        id: session._id,
        phoneNumber: session.phoneNumber,
        status: session.status,
        startTime: session.startTime,
        endTime: session.endTime,
        duration: session.duration,
        callResult: session.callResult,
        twilioCallSid: session.twilioCallSid,
        customer: session.customerId
      }))
    }

    console.log('[Bulk Call API] Status retrieved:', sessions.length, 'sessions')
    return NextResponse.json(responseData)

  } catch (error) {
    console.error('[Bulk Call API] Status error:', error)
    return NextResponse.json(
      { error: 'Failed to get call status', details: error.message },
      { status: 500 }
    )
  }
}