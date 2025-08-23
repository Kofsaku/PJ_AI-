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
    required: true,
    validate: {
      validator: function(v) {
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