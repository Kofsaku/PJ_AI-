import { NextRequest, NextResponse } from 'next/server'

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
    password: { type: String, required: true },
    companyId: String,
    role: { type: String, default: 'user' },
    firstName: String,
    lastName: String,
    isActive: { type: Boolean, default: true }
  }, {
    timestamps: true
  })
  const User = mongoose.models.User || mongoose.model('User', UserSchema)

  return { User }
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    console.log('[Admin Login API] POST request')
    console.log('[Admin Login API] Email:', email)
    console.log('[Admin Login API] Password length:', password?.length || 0)

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const mongoose = await initializeMongoose()
    const { User } = defineModels(mongoose)

    // ユーザーを検索
    const user = await User.findOne({ email: email.toLowerCase() })
    if (!user) {
      console.log('[Admin Login API] User not found:', email)
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // 管理者権限の確認
    if (user.role !== 'admin') {
      console.log('[Admin Login API] User is not admin. Role:', user.role)
      return NextResponse.json(
        { error: 'Access denied. Admin privileges required.' },
        { status: 403 }
      )
    }

    // パスワード確認
    const bcrypt = require('bcryptjs')
    const isMatch = await bcrypt.compare(password, user.password)

    if (!isMatch) {
      console.log('[Admin Login API] Password does not match')
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      )
    }

    // JWT生成
    const jwt = require('jsonwebtoken')
    const token = jwt.sign(
      {
        userId: user._id,
        id: user._id,
        email: user.email,
        role: user.role,
        companyId: user.companyId
      },
      process.env.JWT_SECRET || '7f4a8b9c3d2e1f0g5h6i7j8k9l0m1n2o3p4q5r6s7t8u9v0w1x2y3z4a5b6c7d8e9f',
      { expiresIn: '24h' }
    )

    console.log('[Admin Login API] Admin login successful')
    console.log('[Admin Login API] User ID:', user._id)
    console.log('[Admin Login API] User role:', user.role)

    return NextResponse.json({
      id: user._id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      firstName: user.firstName,
      lastName: user.lastName,
      token: token,
      success: true
    })

  } catch (error) {
    console.error('[Admin Login API] Error:', error)

    return NextResponse.json(
      { error: 'Internal server error: ' + (error instanceof Error ? error.message : String(error)) },
      { status: 500 }
    )
  }
}