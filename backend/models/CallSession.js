const mongoose = require('mongoose');

const CallSessionSchema = new mongoose.Schema({
  customerId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Customer', 
    required: false  // Make optional for bulk calls
  },
  phoneNumber: {
    type: String,
    required: false  // Store phone number directly
  },
  twilioCallSid: { 
    type: String, 
    required: false,  // Make optional until Twilio call is created
    unique: true,
    sparse: true  // Allow multiple null values
  },
  conferenceSid: {
    type: String,
    sparse: true
  },
  status: { 
    type: String, 
    enum: ['initiating', 'calling', 'initiated', 'ai-responding', 'transferring', 'human-connected', 'completed', 'failed', 'cancelled', 'in-progress', 'queued'],
    default: 'initiating'
  },
  error: {
    type: String,
    required: false
  },
  startTime: { 
    type: Date, 
    default: Date.now 
  },
  endTime: Date,
  endReason: {
    type: String,
    enum: ['normal', 'ai_initiated', 'customer_hangup', 'agent_hangup', 'transfer', 'timeout', 'system_error', 'network_error', 'manual'],
    required: false
  },
  assignedAgent: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  transcript: [{
    timestamp: { 
      type: Date, 
      default: Date.now 
    },
    speaker: { 
      type: String, 
      enum: ['ai', 'customer', 'agent'] 
    },
    message: String,
    confidence: Number
  }],
  handoffTime: Date,
  handoffReason: String,
  handoffDetails: {
    requestedBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User' 
    },
    requestedAt: Date,
    connectedAt: Date,
    disconnectedAt: Date,
    handoffPhoneNumber: String,
    handoffCallSid: String,
    handoffMethod: {
      type: String,
      enum: ['manual', 'auto', 'ai-triggered'],
      default: 'manual'
    }
  },
  participants: [{
    type: {
      type: String,
      enum: ['customer', 'ai', 'agent']
    },
    callSid: String,
    phoneNumber: String,
    joinedAt: Date,
    leftAt: Date,
    isMuted: Boolean,
    isOnHold: Boolean
  }],
  recordingSettings: {
    enabled: { type: Boolean, default: true },
    retentionDays: { type: Number, default: 7 },
    deleteAfter: Date
  },
  callResult: {
    type: String,
    enum: ['成功', '不在', '拒否', '要フォロー', '失敗']
  },
  notes: String,
  duration: Number,
  recordingUrl: String,
  aiConfiguration: {
    companyName: String,
    serviceName: String,
    representativeName: String,
    targetDepartment: String
  }
}, { 
  timestamps: true 
});

// インデックスの追加
CallSessionSchema.index({ customerId: 1, createdAt: -1 });
CallSessionSchema.index({ assignedAgent: 1, createdAt: -1 });
CallSessionSchema.index({ status: 1 });
// twilioCallSidは既にスキーマレベルでunique: trueが設定されているため、追加のインデックスは不要

// 通話時間を計算するメソッド
CallSessionSchema.methods.calculateDuration = function() {
  if (this.endTime && this.startTime) {
    this.duration = Math.floor((this.endTime - this.startTime) / 1000); // 秒単位
  }
  return this.duration;
};

// 録音の自動削除日を設定
CallSessionSchema.pre('save', function(next) {
  if (this.isNew && this.recordingSettings.enabled) {
    const deleteDate = new Date();
    deleteDate.setDate(deleteDate.getDate() + this.recordingSettings.retentionDays);
    this.recordingSettings.deleteAfter = deleteDate;
  }
  next();
});

// アクティブな通話を取得するスタティックメソッド
CallSessionSchema.statics.getActiveCalls = function() {
  return this.find({
    status: { $in: ['initiating', 'calling', 'initiated', 'ai-responding', 'transferring', 'human-connected', 'in-progress'] }
  }).populate('customerId assignedAgent');
};

// 通話結果の統計を取得するスタティックメソッド
CallSessionSchema.statics.getCallStatistics = async function(agentId, dateRange) {
  const query = {};
  if (agentId) {
    query.assignedAgent = agentId;
  }
  if (dateRange) {
    query.createdAt = {
      $gte: dateRange.start,
      $lte: dateRange.end
    };
  }

  const stats = await this.aggregate([
    { $match: query },
    {
      $group: {
        _id: '$callResult',
        count: { $sum: 1 },
        avgDuration: { $avg: '$duration' }
      }
    }
  ]);

  return stats;
};

module.exports = mongoose.model('CallSession', CallSessionSchema);