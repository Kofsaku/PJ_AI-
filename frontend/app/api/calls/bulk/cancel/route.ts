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
    recordingSid: String
  }, {
    timestamps: true
  })

  CallSessionSchema.index({ customerId: 1, createdAt: -1 })
  CallSessionSchema.index({ assignedAgent: 1, createdAt: -1 })
  CallSessionSchema.index({ status: 1 })

  const CallSession = mongoose.models.CallSession || mongoose.model('CallSession', CallSessionSchema)

  return { User, CallSession }
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

// Twilio通話キャンセル
async function cancelTwilioCall(callSid) {
  try {
    if (!callSid) {
      console.log('[Twilio Cancel] No call SID provided')
      return null
    }

    const twilio = require('twilio')
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN

    if (!accountSid || !authToken) {
      throw new Error('Twilio credentials not configured')
    }

    const client = twilio(accountSid, authToken)

    console.log(`[Twilio Cancel] Cancelling call: ${callSid}`)

    // 通話をキャンセル（completed状態に更新）
    const call = await client.calls(callSid).update({
      status: 'completed'
    })

    console.log(`[Twilio Cancel] Call cancelled successfully: ${callSid}`)
    return call
  } catch (error) {
    console.error(`[Twilio Cancel] Error cancelling call ${callSid}:`, error)
    // Twilioエラーでもセッションの更新は続行
    return null
  }
}

// POST: 一斉通話キャンセル
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const body = await request.json()
    const { sessionIds, reason = 'user-cancelled' } = body

    console.log('[Bulk Cancel API] POST request - sessionIds:', sessionIds?.length)

    // 認証
    const user = await authenticateUser(token)
    if (!user) {
      return NextResponse.json(
        { error: 'Not authorized to access this route' },
        { status: 401 }
      )
    }

    console.log('[Bulk Cancel API] POST request from user:', user.email, 'companyId:', user.companyId)

    const mongoose = await initializeMongoose()
    const { CallSession } = defineModels(mongoose)

    let query = { companyId: user.companyId }

    // 特定のセッションIDが指定されている場合
    if (sessionIds && Array.isArray(sessionIds) && sessionIds.length > 0) {
      query._id = { $in: sessionIds }
    } else {
      // アクティブな通話のみキャンセル
      query.status = { $in: ['queued', 'initiating', 'calling', 'initiated', 'ai-responding'] }
    }

    // キャンセル対象のセッションを取得
    const sessionsToCancel = await CallSession.find(query)

    console.log(`[Bulk Cancel API] Found ${sessionsToCancel.length} sessions to cancel`)

    if (sessionsToCancel.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active calls to cancel',
        cancelledCount: 0
      })
    }

    let cancelledCount = 0
    const cancelledSessions = []

    // 各セッションをキャンセル
    for (const session of sessionsToCancel) {
      try {
        console.log(`[Bulk Cancel API] Cancelling session: ${session._id}`)

        // Twilio通話がある場合はキャンセル
        if (session.twilioCallSid) {
          await cancelTwilioCall(session.twilioCallSid)
        }

        // セッションステータスを更新
        session.status = 'cancelled'
        session.endTime = new Date()
        session.endReason = reason
        session.notes = session.notes ?
          `${session.notes}\n[${new Date().toISOString()}] Call cancelled by user` :
          `[${new Date().toISOString()}] Call cancelled by user`

        await session.save()

        cancelledSessions.push({
          id: session._id,
          phoneNumber: session.phoneNumber,
          status: session.status,
          endTime: session.endTime
        })

        cancelledCount++
        console.log(`[Bulk Cancel API] Session cancelled: ${session._id}`)

      } catch (error) {
        console.error(`[Bulk Cancel API] Error cancelling session ${session._id}:`, error)
        // 個別のキャンセルエラーは無視して続行
      }
    }

    const responseData = {
      success: true,
      message: `${cancelledCount} call(s) cancelled successfully`,
      cancelledCount,
      cancelledSessions,
      requestedCount: sessionsToCancel.length
    }

    console.log('[Bulk Cancel API] Bulk cancel completed:', responseData)
    return NextResponse.json(responseData)

  } catch (error) {
    console.error('[Bulk Cancel API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to cancel calls', details: error.message },
      { status: 500 }
    )
  }
}