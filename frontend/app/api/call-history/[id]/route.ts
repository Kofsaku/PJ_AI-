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

  // CallSessionモデル定義（統一スキーマ）
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

  return { User, Customer, CallSession }
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

// GET specific call session by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const callSessionId = params.id

    console.log(`[Call History Detail API] GET request for callSessionId: ${callSessionId}`)

    // 認証
    const user = await authenticateUser(token)
    if (!user) {
      return NextResponse.json(
        { error: 'Not authorized to access this route' },
        { status: 401 }
      )
    }

    console.log('[Call History Detail API] GET request from user:', user.email, 'companyId:', user.companyId)

    const mongoose = await initializeMongoose()
    const { CallSession } = defineModels(mongoose)

    // Get specific call session with customer details
    const callSession = await CallSession.findOne({
      _id: callSessionId,
      companyId: user.companyId
    }).populate('customerId', 'customer phone email company address')

    if (!callSession) {
      console.log('[Call History Detail API] Call session not found:', callSessionId)
      return NextResponse.json(
        { error: 'Call session not found' },
        { status: 404 }
      )
    }

    console.log('[Call History Detail API] Call session found and authorized')

    // データ構造をフロントエンドの期待する形式に変換
    const sessionObj = callSession.toObject()
    if (sessionObj.customerId && sessionObj.customerId.customer) {
      sessionObj.customer = {
        ...sessionObj.customerId,
        name: sessionObj.customerId.customer
      }
    } else {
      sessionObj.customer = {
        name: sessionObj.phoneNumber || '不明',
        phone: sessionObj.phoneNumber || '',
        email: '',
        company: ''
      }
    }

    sessionObj.id = sessionObj._id
    delete sessionObj.customerId

    return NextResponse.json({
      success: true,
      data: sessionObj
    })
  } catch (error) {
    console.error('[Call History Detail API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch call session', details: error.message },
      { status: 500 }
    )
  }
}

// PATCH (update) specific call session
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const callSessionId = params.id
    const body = await request.json()

    console.log(`[Call History Detail API] PATCH request for callSessionId: ${callSessionId}`)

    // 認証
    const user = await authenticateUser(token)
    if (!user) {
      return NextResponse.json(
        { error: 'Not authorized to access this route' },
        { status: 401 }
      )
    }

    console.log('[Call History Detail API] PATCH request from user:', user.email, 'companyId:', user.companyId)

    const mongoose = await initializeMongoose()
    const { CallSession } = defineModels(mongoose)

    // 許可された更新フィールドの検証
    const updates = Object.keys(body)
    const allowedUpdates = ['endTime', 'duration', 'status', 'callResult', 'transcript', 'notes', 'phoneNumber']
    const isValidOperation = updates.every(update => allowedUpdates.includes(update))

    if (!isValidOperation) {
      console.log('[Call History Detail API] PATCH Invalid updates:', updates.filter(u => !allowedUpdates.includes(u)))
      return NextResponse.json(
        { error: 'Invalid updates!' },
        { status: 400 }
      )
    }

    const callSession = await CallSession.findOneAndUpdate(
      { _id: callSessionId, companyId: user.companyId },
      body,
      { new: true, runValidators: true }
    ).populate('customerId', 'customer phone email company address')

    if (!callSession) {
      console.log('[Call History Detail API] PATCH Call session access denied or not found')
      return NextResponse.json(
        { error: 'Call session not found' },
        { status: 404 }
      )
    }

    console.log('[Call History Detail API] PATCH Call session updated successfully')
    return NextResponse.json(callSession)
  } catch (error) {
    console.error('[Call History Detail API] PATCH Error:', error)
    return NextResponse.json(
      { error: 'Failed to update call session', details: error.message },
      { status: 400 }
    )
  }
}

// DELETE specific call session
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const callSessionId = params.id

    console.log(`[Call History Detail API] DELETE request for callSessionId: ${callSessionId}`)

    // 認証
    const user = await authenticateUser(token)
    if (!user) {
      return NextResponse.json(
        { error: 'Not authorized to access this route' },
        { status: 401 }
      )
    }

    console.log('[Call History Detail API] DELETE request from user:', user.email, 'companyId:', user.companyId)

    const mongoose = await initializeMongoose()
    const { CallSession } = defineModels(mongoose)

    const callSession = await CallSession.findOneAndDelete({
      _id: callSessionId,
      companyId: user.companyId
    })

    if (!callSession) {
      console.log('[Call History Detail API] DELETE Call session access denied or not found')
      return NextResponse.json(
        { error: 'Call session not found' },
        { status: 404 }
      )
    }

    console.log('[Call History Detail API] DELETE Call session deleted successfully')
    return NextResponse.json({ message: 'Call session deleted successfully' })
  } catch (error) {
    console.error('[Call History Detail API] DELETE Error:', error)
    return NextResponse.json(
      { error: 'Failed to delete call session', details: error.message },
      { status: 500 }
    )
  }
}