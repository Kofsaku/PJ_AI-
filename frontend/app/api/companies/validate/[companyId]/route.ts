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
      unique: true
    },
    name: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'pending'],
      default: 'active'
    }
  }, {
    timestamps: true
  })

  const Company = mongoose.models.Company || mongoose.model('Company', CompanySchema)

  // Userモデル定義
  const UserSchema = new mongoose.Schema({
    firstName: String,
    lastName: String,
    email: String,
    companyId: String,
    role: String,
    isCompanyAdmin: { type: Boolean, default: false }
  })
  const User = mongoose.models.User || mongoose.model('User', UserSchema)

  return { Company, User }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { companyId: string } }
) {
  try {
    console.log('[Company Validate API] Validating companyId:', params.companyId)

    const mongoose = await initializeMongoose()
    const { Company, User } = defineModels(mongoose)

    const company = await Company.findOne({ companyId: params.companyId, status: 'active' })

    if (!company) {
      return NextResponse.json({
        success: false,
        error: 'Invalid company ID'
      }, { status: 404 })
    }

    // 管理者が存在するかチェック
    const existingAdmin = await User.findOne({
      companyId: params.companyId,
      $or: [
        { role: { $in: ['admin', 'company-admin'] } },
        { isCompanyAdmin: true }
      ]
    })

    return NextResponse.json({
      success: true,
      data: {
        companyId: company.companyId,
        name: company.name,
        hasAdmin: !!existingAdmin
      }
    })
  } catch (error) {
    console.error('[Company Validate API] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to validate company',
        details: error.message
      },
      { status: 500 }
    )
  }
}