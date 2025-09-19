import { NextRequest, NextResponse } from 'next/server';

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
  // Companyモデル定義
  const CompanySchema = new mongoose.Schema({
    companyId: {
      type: String,
      required: true,
      unique: true,
      default: function() {
        const crypto = require('crypto')
        return crypto.randomBytes(16).toString('base64url')
      }
    },
    name: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true
    },
    address: {
      type: String,
      required: [true, 'Address is required'],
      trim: true
    },
    url: {
      type: String,
      trim: true,
      default: ''
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    postalCode: {
      type: String,
      trim: true,
      default: ''
    },
    lastCall: {
      type: Date,
      default: null
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'pending'],
      default: 'active'
    },
    createdBy: {
      type: String,
      default: 'admin'
    }
  }, {
    timestamps: true
  })

  const Company = mongoose.models.Company || mongoose.model('Company', CompanySchema)

  // Userモデル定義（会社の詳細情報取得で使用）
  const UserSchema = new mongoose.Schema({
    firstName: String,
    lastName: String,
    email: String,
    phone: String,
    companyId: String,
    createdAt: Date
  })
  const User = mongoose.models.User || mongoose.model('User', UserSchema)

  return { Company, User }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('[Companies API] GET by ID:', params.id)

    const mongoose = await initializeMongoose()
    const { Company, User } = defineModels(mongoose)

    const company = await Company.findById(params.id)
    if (!company) {
      console.log('Company not found')
      return NextResponse.json({
        success: false,
        error: 'Company not found'
      }, { status: 404 })
    }

    console.log('Company found:', company.name)

    // 関連するユーザーを取得
    const users = await User.find({ companyId: company.companyId })
      .select('firstName lastName email phone createdAt')
      .sort({ createdAt: -1 })

    console.log(`Found ${users.length} users for company ${company.companyId}`)

    const userList = users.map(user => ({
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`,
      email: user.email,
      phone: user.phone,
      createdAt: user.createdAt
    }))

    const responseData = {
      success: true,
      data: {
        company: company,
        users: {
          totalCount: users.length,
          userList: userList
        }
      }
    }

    console.log('Sending response:', JSON.stringify(responseData, null, 2))

    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
  } catch (error) {
    console.error('[Companies API] GET by ID Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch company',
        details: error.message
      },
      { status: 500 }
    )
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json()

    console.log('[Companies API] PUT by ID:', params.id)

    const mongoose = await initializeMongoose()
    const { Company } = defineModels(mongoose)

    const company = await Company.findByIdAndUpdate(
      params.id,
      body,
      {
        new: true,
        runValidators: true
      }
    )

    if (!company) {
      return NextResponse.json({
        success: false,
        error: 'Company not found'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: company
    })
  } catch (error) {
    console.error('[Companies API] PUT by ID Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update company',
        details: error.message
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('[Companies API] DELETE by ID:', params.id)

    const mongoose = await initializeMongoose()
    const { Company } = defineModels(mongoose)

    const company = await Company.findByIdAndDelete(params.id)

    if (!company) {
      return NextResponse.json({
        success: false,
        error: 'Company not found'
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      message: 'Company deleted successfully'
    })
  } catch (error) {
    console.error('[Companies API] DELETE by ID Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete company',
        details: error.message
      },
      { status: 500 }
    )
  }
}