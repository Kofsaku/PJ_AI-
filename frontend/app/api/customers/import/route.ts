import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Node.js Runtime指定（Vercel Edge Runtime回避）
export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { customers } = body
    const token = req.headers.get('authorization')?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json(
        { error: 'Authorization required' },
        { status: 401 }
      )
    }

    // MongoDB直接接続
    const mongoose = require('mongoose')
    const jwt = require('jsonwebtoken')

    // MongoDB接続
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://kosakutsubata:f10Kl6uGREjqHoWh@cluster0.cu3zvlo.mongodb.net/ai-call?retryWrites=true&w=majority&appName=Cluster0')
    }

    // JWT検証とユーザー情報取得
    const decoded = jwt.verify(token, process.env.JWT_SECRET || '7f4a8b9c3d2e1f0g5h6i7j8k9l0m1n2o3p4q5r6s7t8u9v0w1x2y3z4a5b6c7d8e9f')

    // Userモデル定義
    const UserSchema = new mongoose.Schema({
      email: { type: String, required: true, unique: true },
      companyId: String,
      role: { type: String, default: 'user' }
    })
    const User = mongoose.models.User || mongoose.model('User', UserSchema)

    // ユーザー取得
    const user = await User.findById(decoded.userId || decoded.id)
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

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

    // データ検証
    if (!customers || !Array.isArray(customers)) {
      return NextResponse.json(
        { error: 'Invalid data format' },
        { status: 400 }
      )
    }

    console.log('[Customer Import] Processing', customers.length, 'customers')
    console.log('[Customer Import] First customer sample:', customers[0])

    // 顧客データの検証とフォーマット
    const validatedCustomers = customers.map((customer, index) => {
      const validated = {
        companyId: user.companyId,
        customer: customer.customer || 'Unknown',
        date: customer.date || new Date().toISOString().split('T')[0],
        time: customer.time || '00:00',
        duration: customer.duration || '0',
        result: customer.result || '未対応',
        notes: customer.notes || '',
        address: customer.address || '',
        phone: customer.phone || '',
        email: customer.email || '',
        company: customer.company || ''
      }

      if (index === 0) {
        console.log('[Customer Import] Original customer:', customer)
        console.log('[Customer Import] Validated customer:', validated)
        console.log('[Customer Import] Result field - original:', customer.result, 'validated:', validated.result)
      }

      return validated
    })

    // データベースに挿入
    const insertedCustomers = await Customer.insertMany(validatedCustomers)

    return NextResponse.json({
      message: `${insertedCustomers.length} customers imported successfully`,
      count: insertedCustomers.length
    })
  } catch (error) {
    console.error('Import error:', error)

    // JWT関連のエラー
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to import customers', details: error.message },
      { status: 500 }
    )
  }
}