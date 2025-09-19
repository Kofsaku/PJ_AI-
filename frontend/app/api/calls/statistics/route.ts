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
    status: {
      type: String,
      enum: {
        values: VALID_STATUS,
        message: 'Invalid status value: {VALUE}. Must be one of: ' + VALID_STATUS.join(', ')
      },
      default: 'initiating'
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
    twilioRecordingUrl: String
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

// GET: 通話統計取得
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period') || 'today' // today, week, month, all

    console.log('[Call Statistics API] GET request - period:', period)

    // 認証
    const user = await authenticateUser(token)
    if (!user) {
      return NextResponse.json(
        { error: 'Not authorized to access this route' },
        { status: 401 }
      )
    }

    console.log('[Call Statistics API] GET request from user:', user.email, 'companyId:', user.companyId)

    const mongoose = await initializeMongoose()
    const { CallSession } = defineModels(mongoose)

    // 期間に基づく日付フィルター
    let dateFilter = {}
    const now = new Date()

    switch (period) {
      case 'today':
        const startOfDay = new Date(now)
        startOfDay.setHours(0, 0, 0, 0)
        const endOfDay = new Date(now)
        endOfDay.setHours(23, 59, 59, 999)
        dateFilter = {
          createdAt: {
            $gte: startOfDay,
            $lte: endOfDay
          }
        }
        break
      case 'week':
        const startOfWeek = new Date(now)
        startOfWeek.setDate(now.getDate() - now.getDay())
        startOfWeek.setHours(0, 0, 0, 0)
        dateFilter = {
          createdAt: {
            $gte: startOfWeek
          }
        }
        break
      case 'month':
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        dateFilter = {
          createdAt: {
            $gte: startOfMonth
          }
        }
        break
      case 'all':
      default:
        // フィルターなし
        break
    }

    const baseQuery = { companyId: user.companyId, ...dateFilter }

    // 基本統計を並列で取得
    const [
      totalCalls,
      completedCalls,
      successfulCalls,
      activeCalls,
      failedCalls,
      cancelledCalls,
      avgDurationResult
    ] = await Promise.all([
      // 総通話数
      CallSession.countDocuments(baseQuery),

      // 完了した通話数
      CallSession.countDocuments({
        ...baseQuery,
        status: 'completed'
      }),

      // 成功した通話数
      CallSession.countDocuments({
        ...baseQuery,
        callResult: '成功'
      }),

      // アクティブな通話数
      CallSession.countDocuments({
        ...baseQuery,
        status: { $in: ['initiating', 'calling', 'initiated', 'ai-responding', 'in-progress'] }
      }),

      // 失敗した通話数
      CallSession.countDocuments({
        ...baseQuery,
        status: 'failed'
      }),

      // キャンセルされた通話数
      CallSession.countDocuments({
        ...baseQuery,
        status: 'cancelled'
      }),

      // 平均通話時間
      CallSession.aggregate([
        { $match: { ...baseQuery, duration: { $exists: true, $ne: null } } },
        {
          $group: {
            _id: null,
            avgDuration: { $avg: '$duration' }
          }
        }
      ])
    ])

    // 通話結果別の統計
    const callResultStats = await CallSession.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: '$callResult',
          count: { $sum: 1 }
        }
      }
    ])

    // ステータス別の統計
    const statusStats = await CallSession.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ])

    // 成功率計算
    const successRate = totalCalls > 0 ? Math.round((successfulCalls / totalCalls) * 100) : 0

    // 平均通話時間（秒単位）
    const avgDuration = avgDurationResult.length > 0 ? Math.round(avgDurationResult[0].avgDuration) : 0

    // 統計データの整形
    const statistics = {
      totalCalls,
      completedCalls,
      successfulCalls,
      activeCalls: activeCalls,
      failedCalls,
      cancelledCalls,
      successRate: `${successRate}%`,
      avgDuration, // 秒単位
      activeCallsNow: activeCalls,
      callResultBreakdown: callResultStats.reduce((acc, item) => {
        if (item._id) {
          acc[item._id] = item.count
        }
        return acc
      }, {}),
      statusBreakdown: statusStats.reduce((acc, item) => {
        if (item._id) {
          acc[item._id] = item.count
        }
        return acc
      }, {}),
      period
    }

    console.log('[Call Statistics API] Statistics generated:', statistics)

    return NextResponse.json({
      success: true,
      data: statistics
    })

  } catch (error) {
    console.error('[Call Statistics API] Error:', error)

    // エラー時のデフォルト統計
    const defaultStats = {
      totalCalls: 0,
      successRate: '0%',
      avgDuration: 0,
      activeCallsNow: 0,
      completedCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      cancelledCalls: 0,
      callResultBreakdown: {},
      statusBreakdown: {},
      period: 'today'
    }

    return NextResponse.json({
      success: false,
      data: defaultStats,
      error: error.message
    })
  }
}