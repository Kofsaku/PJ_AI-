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
  // Userモデル定義
  const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    companyId: String,
    role: { type: String, default: 'user' }
  })
  const User = mongoose.models.User || mongoose.model('User', UserSchema)

  // AgentSettingsモデル定義
  const AgentSettingsSchema = new mongoose.Schema({
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },
    phoneNumber: {
      type: String,
      required: false,
      validate: {
        validator: function(v) {
          if (!v) return true;
          return /^\+81\d{10,11}$/.test(v) || /^0\d{9,10}$/.test(v);
        },
        message: props => `${props.value} is not a valid phone number!`
      }
    },
    isAvailable: {
      type: Boolean,
      default: true
    },
    conversationSettings: {
      companyName: {
        type: String,
        required: true
      },
      serviceName: {
        type: String,
        required: true
      },
      representativeName: {
        type: String,
        required: true
      },
      targetDepartment: {
        type: String,
        required: true,
        default: '営業部'
      },
      salesPitch: {
        companyDescription: {
          type: String,
          default: '弊社では、{{serviceName}}を提供しております。AIが一次架電を行い、見込み度の高いお客様だけを営業におつなぎする仕組みです。'
        },
        serviceDescription: {
          type: String,
          default: '（1）AIが自動で一次架電→要件把握、（2）見込み度スコアで仕分け、（3）高確度のみ人の営業に引き継ぎ、という流れです。架電の無駄を削減し、商談化率の向上に寄与します。'
        },
        keyBenefits: [{
          type: String
        }],
        callToAction: {
          type: String,
          default: 'ぜひ御社の{{targetDepartment}}ご担当者さまに概要をご案内できればと思いまして。'
        }
      },
      serviceDescription: {
        type: String,
        default: '新規テレアポや掘り起こしなどの営業電話を人間に代わって生成AIが電話をかけるというサービスを提供している'
      },
      targetPerson: {
        type: String,
        default: '営業の担当者さま'
      },
      customTemplates: {
        initial: {
          type: String,
          default: 'お世話になります。{{selfIntroduction}}。弊社は{{serviceDescription}}会社でございます。{{serviceName}}について、是非御社の{{targetDepartment}}にご案内できればと思いお電話をさせていただきました。本日、{{targetPerson}}はいらっしゃいますでしょうか？'
        },
        clarification: {
          type: String,
          default: '失礼しました。{{companyName}}の{{representativeName}}です。{{serviceName}}についてご担当者さまにご案内の可否を伺っております。'
        },
        absent: {
          type: String,
          default: '承知しました。では、また改めてお電話いたします。ありがとうございました。'
        },
        rejection: {
          type: String,
          default: '承知しました。ご多忙のところ申し訳ございません。ご対応ありがとうございました。失礼いたします。'
        },
        website_redirect: {
          type: String,
          default: 'かしこまりました。それでは御社ホームページよりご改めてご連絡させていただきます。ご対応ありがとうございました。失礼いたします。'
        },
        closing: {
          type: String,
          default: '本日はありがとうございました。失礼いたします。'
        },
        sales_pitch: {
          type: String,
          default: 'ありがとうございます。{{companyDescription}} {{callToAction}}'
        },
        positive_response: {
          type: String,
          default: 'ありがとうございます。よろしくお願いいたします。'
        },
        transfer_explanation: {
          type: String,
          default: 'お忙しいところすみません。{{selfIntroduction}}。弊社は{{serviceDescription}}会社でございます。\n\nこれより直接担当者から詳細をご説明させて頂いてもよろしいでしょうか？\nお構いなければAIコールシステムから弊社の担当者に取り次ぎのうえご説明申し上げます。'
        },
        prepare_transfer: {
          type: String,
          default: 'ありがとうございます。よろしくお願いいたします。'
        },
        transfer_accepted: {
          type: String,
          default: 'ありがとうございます。お待ちしております。'
        }
      },
      systemMessages: {
        systemError: {
          type: String,
          default: 'システムエラーが発生しました。申し訳ございません。'
        },
        agentConnection: {
          type: String,
          default: '担当者におつなぎいたします。少々お待ちください。'
        },
        noAnswer: {
          type: String,
          default: 'お客様、お聞きになれますか？'
        },
        tooManyClarifications: {
          type: String,
          default: '申し訳ございません。音声が聞き取りづらいようでしたら、後日改めてご連絡いたします。ありがとうございました。'
        },
        unknown: {
          type: String,
          default: '申し訳ございません。もう一度お聞きしてもよろしいでしょうか？'
        }
      }
    },
    notificationPreferences: {
      enableCallNotifications: {
        type: Boolean,
        default: true
      },
      enableEmailNotifications: {
        type: Boolean,
        default: false
      },
      workingHours: {
        start: {
          type: String,
          default: '09:00'
        },
        end: {
          type: String,
          default: '18:00'
        },
        timezone: {
          type: String,
          default: 'Asia/Tokyo'
        }
      }
    },
    priority: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    }
  }, {
    timestamps: true
  })

  const AgentSettings = mongoose.models.AgentSettings || mongoose.model('AgentSettings', AgentSettingsSchema)

  return { User, AgentSettings }
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

// GET sales pitch settings
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')

    console.log('[Sales Pitch API] GET request')

    // 認証
    const user = await authenticateUser(token)
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Authorization header required' },
        { status: 401 }
      )
    }

    console.log('[Sales Pitch API] GET request from user:', user.email, 'userId:', user._id)

    const mongoose = await initializeMongoose()
    const { AgentSettings } = defineModels(mongoose)

    // ユーザーのAgentSettingsを取得
    let agentSettings = await AgentSettings.findOne({ userId: user._id })

    if (!agentSettings) {
      // AgentSettingsが存在しない場合はデフォルト値で作成
      console.log('[Sales Pitch API] Creating default AgentSettings for user:', user._id)
      agentSettings = await AgentSettings.create({
        userId: user._id,
        conversationSettings: {
          companyName: '株式会社サンプル',
          serviceName: 'AIコールサービス',
          representativeName: 'サンプル太郎',
          targetDepartment: '営業部'
        }
      })
    }

    console.log('[Sales Pitch API] AgentSettings found/created successfully')

    // セールスピッチ関連の設定のみを返す
    const salesPitchData = {
      success: true,
      data: {
        conversationSettings: agentSettings.conversationSettings
      }
    }

    return NextResponse.json(salesPitchData)

  } catch (error) {
    console.error('[Sales Pitch API] Get error:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

// PUT update sales pitch settings
export async function PUT(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const body = await request.json()

    console.log('[Sales Pitch API] PUT request')

    // 認証
    const user = await authenticateUser(token)
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Authorization header required' },
        { status: 401 }
      )
    }

    console.log('[Sales Pitch API] PUT request from user:', user.email, 'userId:', user._id)

    const mongoose = await initializeMongoose()
    const { AgentSettings } = defineModels(mongoose)

    // ユーザーのAgentSettingsを更新
    let agentSettings = await AgentSettings.findOne({ userId: user._id })

    if (!agentSettings) {
      // AgentSettingsが存在しない場合は作成
      console.log('[Sales Pitch API] Creating new AgentSettings for user:', user._id)
      agentSettings = await AgentSettings.create({
        userId: user._id,
        conversationSettings: body.conversationSettings || {}
      })
    } else {
      // 既存のAgentSettingsを更新
      console.log('[Sales Pitch API] Updating existing AgentSettings for user:', user._id)

      // conversationSettingsを更新（ディープマージ）
      if (body.conversationSettings) {
        agentSettings.conversationSettings = {
          ...agentSettings.conversationSettings.toObject(),
          ...body.conversationSettings
        }

        // salesPitchとcustomTemplatesも個別にマージ
        if (body.conversationSettings.salesPitch) {
          agentSettings.conversationSettings.salesPitch = {
            ...agentSettings.conversationSettings.salesPitch.toObject(),
            ...body.conversationSettings.salesPitch
          }
        }

        if (body.conversationSettings.customTemplates) {
          agentSettings.conversationSettings.customTemplates = {
            ...agentSettings.conversationSettings.customTemplates.toObject(),
            ...body.conversationSettings.customTemplates
          }
        }
      }

      await agentSettings.save()
    }

    console.log('[Sales Pitch API] AgentSettings updated successfully')

    const salesPitchData = {
      success: true,
      message: '保存に成功しました',
      data: {
        conversationSettings: agentSettings.conversationSettings
      }
    }

    return NextResponse.json(salesPitchData)

  } catch (error) {
    console.error('[Sales Pitch API] Update error:', error)
    return NextResponse.json(
      { success: false, message: '保存に失敗しました', details: error.message },
      { status: 500 }
    )
  }
}