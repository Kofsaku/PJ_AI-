const mongoose = require('mongoose');
const CallSession = require('./models/CallSession');

async function debugLiveConfig() {
  try {
    require('dotenv').config();
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB接続成功');

    // 最新のCallSessionを確認
    const latestSession = await CallSession.findOne({}).sort({ createdAt: -1 });
    
    if (latestSession) {
      console.log('\n=== 最新のCallSession ===');
      console.log('CallSession ID:', latestSession._id);
      console.log('Phone Number:', latestSession.phoneNumber);
      console.log('Status:', latestSession.status);
      console.log('assignedAgent:', latestSession.assignedAgent);

      console.log('\n=== aiConfiguration の詳細 ===');
      console.log('aiConfiguration:', JSON.stringify(latestSession.aiConfiguration, null, 2));
      
      if (latestSession.aiConfiguration && latestSession.aiConfiguration.salesPitch) {
        console.log('\n=== salesPitch 確認 ===');
        console.log('companyDescription:', latestSession.aiConfiguration.salesPitch.companyDescription);
        console.log('callToAction:', latestSession.aiConfiguration.salesPitch.callToAction);
      } else {
        console.log('\n=== 問題発見 ===');
        console.log('aiConfiguration.salesPitch が存在しません！');
      }
    } else {
      console.log('CallSessionが見つかりません');
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('エラー:', error);
  }
}

debugLiveConfig();
