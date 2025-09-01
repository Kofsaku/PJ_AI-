const mongoose = require('mongoose');

const AgentSettingsSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true, 
    unique: true 
  },
  phoneNumber: { 
    type: String, 
    required: false,  // 必須ではなくする
    validate: {
      validator: function(v) {
        // 値がある場合のみ検証
        if (!v) return true;
        // 日本の電話番号形式（国際電話番号形式）をチェック
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
    // カスタムセールスピッチ設定（call_logic.md準拠）
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
    // 新しい変数フィールド
    selfIntroduction: {
      type: String,
      default: 'わたくしＡＩコールシステムの安達と申します'
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
        default: 'お世話になります。{{selfIntroduction}}。弊社は{{serviceDescription}}会社でございます。是非、御社の{{targetDepartment}}にご案内できればと思いお電話をさせていただきました！本日、{{targetPerson}}はいらっしゃいますでしょうか？'
      },
      clarification: {
        type: String,
        default: '失礼しました。{{companyName}}の{{representativeName}}です。{{serviceName}}についてご担当者さまにご案内の可否を伺っております。'
      },
      company_confirmation: {
        type: String,
        default: '{{companyName}}でございます。{{representativeName}}です。'
      },
      absent: {
        type: String,
        default: '承知しました。では、また改めてお電話いたします。ありがとうございました。'
      },
      rejection: {
        type: String,
        default: '承知いたしました。本日は突然のご連絡で失礼いたしました。よろしくお願いいたします。'
      },
      website_redirect: {
        type: String,
        default: '承知しました。御社ホームページのお問い合わせフォームですね。記載のうえ送付いたします。ありがとうございました。'
      },
      closing: {
        type: String,
        default: '本日はありがとうございました。失礼いたします。'
      },
      sales_pitch: {
        type: String,
        default: 'ありがとうございます。よろしくお願いいたします。'
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
      }
    },
    // システムメッセージテンプレート
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
});

// インデックスの追加
// userIdは既にスキーマレベルでunique: trueが設定されているため、追加のインデックスは不要
AgentSettingsSchema.index({ isAvailable: 1, priority: -1 });

// テンプレートの変数を置換するメソッド
AgentSettingsSchema.methods.processTemplate = function(templateName, additionalVars = {}) {
  let template = null;
  
  // customTemplatesまたはsystemMessagesから取得
  if (this.conversationSettings.customTemplates && this.conversationSettings.customTemplates[templateName]) {
    template = this.conversationSettings.customTemplates[templateName];
  } else if (this.conversationSettings.systemMessages && this.conversationSettings.systemMessages[templateName]) {
    template = this.conversationSettings.systemMessages[templateName];
  }
  
  if (!template) return null;

  const vars = {
    companyName: this.conversationSettings.companyName,
    serviceName: this.conversationSettings.serviceName,
    representativeName: this.conversationSettings.representativeName,
    targetDepartment: this.conversationSettings.targetDepartment,
    companyDescription: this.conversationSettings.salesPitch?.companyDescription || 'AIコールシステム株式会社では、生成AIを使った新規顧客獲得テレアポ支援により、AIが一次架電と仕分けを行い、見込み度の高いお客さまだけを営業におつなぎする仕組みをご提供しています。',
    // serviceDescriptionを新しい変数で上書き（テンプレート用）
    serviceDescription: this.conversationSettings.serviceDescription || this.conversationSettings.salesPitch?.serviceDescription || '新規テレアポや掘り起こしなどの営業電話を人間に代わって生成AIが電話をかけるというサービスを提供している',
    callToAction: this.conversationSettings.salesPitch?.callToAction || '御社の営業部ご担当者さまに、概要だけご説明させていただけますか？',
    // 新しい変数を追加
    selfIntroduction: this.conversationSettings.selfIntroduction || 'わたくしＡＩコールシステムの安達と申します',
    targetPerson: this.conversationSettings.targetPerson || '営業の担当者さま',
    ...additionalVars
  };

  let processed = template;
  Object.keys(vars).forEach(key => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    processed = processed.replace(regex, vars[key]);
  });

  return processed;
};

// 勤務時間内かチェックするメソッド
AgentSettingsSchema.methods.isWithinWorkingHours = function() {
  const now = new Date();
  const timezone = this.notificationPreferences.workingHours.timezone;
  
  // タイムゾーンを考慮した現在時刻を取得
  const currentTime = new Date(now.toLocaleString('en-US', { timeZone: timezone }));
  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();
  const currentTimeStr = `${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')}`;
  
  const startTime = this.notificationPreferences.workingHours.start;
  const endTime = this.notificationPreferences.workingHours.end;
  
  return currentTimeStr >= startTime && currentTimeStr <= endTime;
};

// 利用可能なエージェントを取得するスタティックメソッド
AgentSettingsSchema.statics.getAvailableAgents = async function() {
  const agents = await this.find({ 
    isAvailable: true 
  }).populate('userId').sort({ priority: -1 });
  
  // 勤務時間内のエージェントのみフィルタリング
  return agents.filter(agent => agent.isWithinWorkingHours());
};

// 電話番号を国際形式に変換するメソッド
AgentSettingsSchema.methods.getInternationalPhoneNumber = function() {
  let phone = this.phoneNumber;
  
  // 既に国際形式の場合はそのまま返す
  if (phone.startsWith('+')) {
    return phone;
  }
  
  // 日本の国内番号の場合は国際形式に変換
  if (phone.startsWith('0')) {
    return '+81' + phone.substring(1);
  }
  
  return phone;
};

module.exports = mongoose.model('AgentSettings', AgentSettingsSchema);