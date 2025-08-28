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
    customTemplates: {
      initial: {
        type: String,
        default: 'お世話になります。{{companyName}}の{{representativeName}}と申します。{{serviceName}}のご案内でお電話しました。本日、{{targetDepartment}}のご担当者さまはいらっしゃいますでしょうか？'
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
      handoff_message: {
        type: String,
        default: '担当者におつなぎいたします。少々お待ちください。'
      },
      sales_pitch: {
        type: String,
        default: '{{companyDescription}} {{callToAction}}'
      },
      sales_pitch_short: {
        type: String,
        default: '{{serviceDescription}} {{callToAction}}'
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
  const template = this.conversationSettings.customTemplates[templateName];
  if (!template) return null;

  const vars = {
    companyName: this.conversationSettings.companyName,
    serviceName: this.conversationSettings.serviceName,
    representativeName: this.conversationSettings.representativeName,
    targetDepartment: this.conversationSettings.targetDepartment,
    companyDescription: this.conversationSettings.salesPitch?.companyDescription || 'AIコールシステム株式会社では、生成AIを使った新規顧客獲得テレアポ支援により、AIが一次架電と仕分けを行い、見込み度の高いお客さまだけを営業におつなぎする仕組みをご提供しています。',
    serviceDescription: this.conversationSettings.salesPitch?.serviceDescription || '概要だけご説明させていただけますか？',
    callToAction: this.conversationSettings.salesPitch?.callToAction || '御社の営業部ご担当者さまに、概要だけご説明させていただけますか？',
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