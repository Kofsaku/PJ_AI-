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

  // CallSessionモデル定義
  const CallSessionSchema = new mongoose.Schema({
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true
    },
    companyId: {
      type: String,
      required: true,
      index: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    endTime: Date,
    duration: String,
    status: {
      type: String,
      enum: ['進行中', '完了', '失敗', '中止'],
      default: '進行中'
    },
    callResult: {
      type: String,
      enum: ['成功', '不在', '拒否', '要フォロー', '失敗', '通話中', '未対応'],
      default: '未対応'
    },
    transcript: String,
    notes: String,
    phoneNumber: String,
    twilioCallSid: String
  }, {
    timestamps: true
  })

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

// GET call history with pagination
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const url = new URL(request.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '10')
    const callSessionId = url.searchParams.get('id')

    console.log(`[Call History API] GET request - page: ${page}, limit: ${limit}, callSessionId: ${callSessionId || 'all'}`)

    // 認証
    const user = await authenticateUser(token)
    if (!user) {
      return NextResponse.json(
        { error: 'Not authorized to access this route' },
        { status: 401 }
      )
    }

    console.log('[Call History API] GET request from user:', user.email, 'companyId:', user.companyId)

    const mongoose = await initializeMongoose()
    const { CallSession, Customer } = defineModels(mongoose)

    if (callSessionId) {
      // Get specific call session
      console.log(`[Call History API] Fetching individual call session: ${callSessionId}`)

      const callSession = await CallSession.findOne({
        _id: callSessionId,
        companyId: user.companyId
      }).populate('customerId', 'customer phone email company')

      if (!callSession) {
        return NextResponse.json(
          { error: 'Call session not found' },
          { status: 404 }
        )
      }

      return NextResponse.json(callSession)
    } else {
      // Get paginated call history
      const skip = (page - 1) * limit

      const callSessions = await CallSession.find({
        companyId: user.companyId
      })
      .populate('customerId', 'customer phone email company')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)

      const total = await CallSession.countDocuments({
        companyId: user.companyId
      })

      console.log('[Call History API] Found', callSessions.length, 'call sessions for companyId:', user.companyId)

      return NextResponse.json({
        callSessions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      })
    }
  } catch (error) {
    console.error('[Call History API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch call history', details: error.message },
      { status: 500 }
    )
  }
}

// POST new call session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const token = request.headers.get('authorization')?.replace('Bearer ', '')

    // 認証
    const user = await authenticateUser(token)
    if (!user) {
      return NextResponse.json(
        { error: 'Not authorized to access this route' },
        { status: 401 }
      )
    }

    console.log('[Call History API] POST request from user:', user.email, 'companyId:', user.companyId)

    const mongoose = await initializeMongoose()
    const { CallSession } = defineModels(mongoose)

    const callSession = new CallSession({
      ...body,
      companyId: user.companyId
    })
    await callSession.save()
    console.log('[Call History API] Created call session with companyId:', callSession.companyId)

    return NextResponse.json(callSession, { status: 201 })
  } catch (error) {
    console.error('[Call History API] Create error:', error)
    return NextResponse.json(
      { error: 'Failed to create call session', details: error.message },
      { status: 400 }
    )
  }
}

// PATCH (update) call session
export async function PATCH(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const url = new URL(request.url)
    const callSessionId = url.searchParams.get('id')
    const body = await request.json()

    if (!callSessionId) {
      return NextResponse.json(
        { error: 'Call session ID is required for update' },
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

    console.log(`[Call History API] PATCH request from user:`, user.email, 'companyId:', user.companyId, 'callSessionId:', callSessionId)

    const mongoose = await initializeMongoose()
    const { CallSession } = defineModels(mongoose)

    // 許可された更新フィールドの検証
    const updates = Object.keys(body)
    const allowedUpdates = ['endTime', 'duration', 'status', 'callResult', 'transcript', 'notes', 'phoneNumber']
    const isValidOperation = updates.every(update => allowedUpdates.includes(update))

    if (!isValidOperation) {
      console.log('[Call History API] PATCH Invalid updates:', updates.filter(u => !allowedUpdates.includes(u)))
      return NextResponse.json(
        { error: 'Invalid updates!' },
        { status: 400 }
      )
    }

    const callSession = await CallSession.findOneAndUpdate(
      { _id: callSessionId, companyId: user.companyId },
      body,
      { new: true, runValidators: true }
    )
    if (!callSession) {
      console.log('[Call History API] PATCH Call session access denied or not found')
      return NextResponse.json(
        { error: 'Call session not found' },
        { status: 404 }
      )
    }

    console.log('[Call History API] PATCH Call session updated successfully')
    return NextResponse.json(callSession)
  } catch (error) {
    console.error('[Call History API] PATCH Error:', error)
    return NextResponse.json(
      { error: 'Failed to update call session', details: error.message },
      { status: 400 }
    )
  }
}