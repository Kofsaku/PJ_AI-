import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Node.js Runtime指定（Vercel Edge Runtime回避）
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, password, firstName, lastName, companyId, phone, address, businessType, employees } = body

    // 必須フィールドチェック
    if (!email || !password || !firstName || !lastName || !companyId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // MongoDBに直接接続
    const mongoose = require('mongoose')
    const bcrypt = require('bcryptjs')
    const jwt = require('jsonwebtoken')

    // MongoDB接続
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://kosakutsubata:f10Kl6uGREjqHoWh@cluster0.cu3zvlo.mongodb.net/ai-call?retryWrites=true&w=majority&appName=Cluster0')
    }

    // Userモデル定義
    const UserSchema = new mongoose.Schema({
      email: { type: String, required: true, unique: true },
      password: { type: String, required: true },
      firstName: String,
      lastName: String,
      companyId: String,
      phone: String,
      address: String,
      businessType: String,
      employees: String,
      role: { type: String, default: 'user' },
      isCompanyAdmin: { type: Boolean, default: false },
      createdAt: { type: Date, default: Date.now }
    })

    // パスワードハッシュ化（pre-save middleware）
    UserSchema.pre('save', async function(next) {
      if (!this.isModified('password')) return next()
      this.password = await bcrypt.hash(this.password, 12)
      next()
    })

    const User = mongoose.models.User || mongoose.model('User', UserSchema)

    // 既存ユーザーチェック
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists with this email' },
        { status: 409 }
      )
    }

    // 新規ユーザー作成
    const newUser = new User({
      email,
      password,
      firstName,
      lastName,
      companyId,
      phone,
      address,
      businessType,
      employees
    })

    await newUser.save()

    // JWT生成
    const token = jwt.sign(
      { 
        userId: newUser._id,
        email: newUser.email,
        companyId: newUser.companyId,
        role: newUser.role 
      },
      process.env.JWT_SECRET || '7f4a8b9c3d2e1f0g5h6i7j8k9l0m1n2o3p4q5r6s7t8u9v0w1x2y3z4a5b6c7d8e9f',
      { expiresIn: '30d' }
    )

    // レスポンス
    const responseData = {
      success: true,
      token,
      user: {
        id: newUser._id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        companyId: newUser.companyId,
        role: newUser.role
      }
    }

    const response = NextResponse.json(responseData)
    
    // セキュアクッキー設定
    response.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Signup error:', error)
    
    // 重複エラーの場合
    if (error.code === 11000) {
      return NextResponse.json(
        { error: 'User already exists with this email' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}