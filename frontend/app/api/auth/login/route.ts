import { NextResponse } from 'next/server'

import type { NextRequest } from 'next/server'

// Node.js Runtime指定（Vercel Edge Runtime回避）
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    // MongoDBに直接接続（Vercel環境変数から接続文字列取得）
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
      password: { type: String, required: true, select: false },
      firstName: String,
      lastName: String,
      companyId: String,
      role: { type: String, default: 'user' },
      isCompanyAdmin: { type: Boolean, default: false }
    })

    UserSchema.methods.comparePassword = async function(enteredPassword) {
      return await bcrypt.compare(enteredPassword, this.password)
    }

    const User = mongoose.models.User || mongoose.model('User', UserSchema)

    // ユーザー検索（パスワードフィールドを含める）
    const user = await User.findOne({ email }).select('+password')

    if (!user || !(await user.comparePassword(password))) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // JWT生成
    const token = jwt.sign(
      { 
        userId: user._id,
        email: user.email,
        companyId: user.companyId,
        role: user.role 
      },
      process.env.JWT_SECRET || '7f4a8b9c3d2e1f0g5h6i7j8k9l0m1n2o3p4q5r6s7t8u9v0w1x2y3z4a5b6c7d8e9f',
      { expiresIn: '30d' }
    )

    // レスポンスデータ
    const responseData = {
      success: true,
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        companyId: user.companyId,
        role: user.role,
        isCompanyAdmin: user.isCompanyAdmin
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
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}