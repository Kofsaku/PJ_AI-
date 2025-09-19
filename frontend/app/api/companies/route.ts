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

  return { Company }
}

export async function GET(req: NextRequest) {
  try {
    console.log('[Companies API] GET request')

    const mongoose = await initializeMongoose()
    const { Company } = defineModels(mongoose)

    const companies = await Company.find().sort({ createdAt: -1 })

    return NextResponse.json({
      success: true,
      data: companies
    })
  } catch (error) {
    console.error('[Companies API] GET Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch companies',
        details: error.message
      },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, address, url, phone, email, postalCode } = body

    console.log('[Companies API] POST request:', name)

    const mongoose = await initializeMongoose()
    const { Company } = defineModels(mongoose)

    // 既存会社の重複チェック
    const existingCompany = await Company.findOne({
      $or: [
        { name: name },
        { phone: phone }
      ]
    })

    if (existingCompany) {
      return NextResponse.json({
        success: false,
        error: 'Company with this name or phone already exists'
      }, { status: 400 })
    }

    const company = await Company.create({
      name,
      address,
      url: url || '',
      phone,
      email: email || '',
      postalCode: postalCode || '',
      createdBy: 'admin'
    })

    return NextResponse.json({
      success: true,
      data: company
    }, { status: 201 })
  } catch (error) {
    console.error('[Companies API] POST Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create company',
        details: error.message
      },
      { status: 500 }
    )
  }
}