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
        { success: false, error: 'Authorization required' },
        { status: 401 }
      )
    }

    // バリデーション強化: データ構造の検証
    if (!customers) {
      return NextResponse.json(
        { success: false, error: 'customers field is required' },
        { status: 400 }
      )
    }

    if (!Array.isArray(customers)) {
      return NextResponse.json(
        { success: false, error: 'customers must be an array' },
        { status: 400 }
      )
    }

    if (customers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'customers array cannot be empty' },
        { status: 400 }
      )
    }

    // MongoDB直接接続
    const mongoose = require('mongoose')
    const jwt = require('jsonwebtoken')
    const z = require('zod')

    // MongoDB接続
    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://kosakutsubata:f10Kl6uGREjqHoWh@cluster0.cu3zvlo.mongodb.net/ai-call?retryWrites=true&w=majority&appName=Cluster0')
    }

    // JWT検証とユーザー情報取得
    let decoded
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || '7f4a8b9c3d2e1f0g5h6i7j8k9l0m1n2o3p4q5r6s7t8u9v0w1x2y3z4a5b6c7d8e9f')
    } catch (jwtError) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 401 }
      )
    }

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
        { success: false, error: 'User not found' },
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

    // 強化されたバリデーションスキーマ
    const CustomerValidationSchema = z.object({
      customer: z.string().min(1, "顧客名は必須です"),
      phone: z.string().regex(/^[\d\-\+\(\)\s]*$/, "電話番号の形式が正しくありません").optional().or(z.literal("")),
      email: z.string().email("メールアドレスの形式が正しくありません").optional().or(z.literal("")),
      address: z.string().optional(),
      company: z.string().optional(),
      notes: z.string().optional(),
      date: z.string().optional(),
      time: z.string().optional(),
      duration: z.string().optional(),
      result: z.string().optional()
    })

    console.log('[Customer Import] Processing', customers.length, 'customers')
    console.log('[Customer Import] First customer sample:', customers[0])

    // 顧客データの検証とフォーマット
    const validationErrors: string[] = []
    const validatedCustomers: any[] = []

    for (let i = 0; i < customers.length; i++) {
      const customer = customers[i]
      
      try {
        // Zodバリデーション
        const validatedInput = CustomerValidationSchema.parse(customer)
        
        const formatted = {
          companyId: user.companyId,
          customer: validatedInput.customer,
          date: validatedInput.date || new Date().toISOString().split('T')[0],
          time: validatedInput.time || '00:00',
          duration: validatedInput.duration || '0',
          result: validatedInput.result || '未対応',
          notes: validatedInput.notes || '',
          address: validatedInput.address || '',
          phone: validatedInput.phone || '',
          email: validatedInput.email || '',
          company: validatedInput.company || ''
        }

        validatedCustomers.push(formatted)

        if (i === 0) {
          console.log('[Customer Import] Original customer:', customer)
          console.log('[Customer Import] Validated customer:', formatted)
        }
      } catch (zodError) {
        if (zodError instanceof z.ZodError) {
          const errorMessages = zodError.errors.map(err => 
            `行${i + 1}: ${err.path.join('.')} - ${err.message}`
          )
          validationErrors.push(...errorMessages)
        } else {
          validationErrors.push(`行${i + 1}: 予期しないエラーが発生しました`)
        }
      }
    }

    // バリデーションエラーがある場合は中断
    if (validationErrors.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'データの検証に失敗しました',
          errors: validationErrors,
          validCount: validatedCustomers.length,
          totalCount: customers.length
        },
        { status: 400 }
      )
    }

    // データベースに挿入
    const insertedCustomers = await Customer.insertMany(validatedCustomers)

    return NextResponse.json({
      success: true,
      message: `${insertedCustomers.length} customers imported successfully`,
      count: insertedCustomers.length,
      errors: []
    })
  } catch (error) {
    console.error('Import error:', error)

    // JWT関連のエラー
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to import customers', 
        details: error.message 
      },
      { status: 500 }
    )
  }
}