const mongoose = require('mongoose');
const AgentSettings = require('./models/AgentSettings');

async function debugActualSettings() {
  try {
    require('dotenv').config();
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB接続成功');

    // 実際の通話で使用されたuserIdを確認
    const userId = '68a070f04f58e8af1812b113'; // ログから取得したuserId
    
    const settings = await AgentSettings.findOne({ userId });
    
    if (settings) {
      console.log('\n=== 実際の通話で使用されたAgentSettings ===');
      console.log('UserId:', settings.userId);
      console.log('companyName:', settings.conversationSettings?.companyName);
      console.log('representativeName:', settings.conversationSettings?.representativeName);
      console.log('serviceName:', settings.conversationSettings?.serviceName);

      console.log('\n=== セールスピッチ設定の詳細 ===');
      console.log('salesPitch object:', JSON.stringify(settings.conversationSettings?.salesPitch, null, 2));
      console.log('companyDescription:', settings.conversationSettings?.salesPitch?.companyDescription);
      console.log('callToAction:', settings.conversationSettings?.salesPitch?.callToAction);
      
      // 空かどうかの判定を実行
      const salesPitch = settings.conversationSettings?.salesPitch;
      if (salesPitch) {
        const companyDesc = salesPitch.companyDescription || '';
        const callAction = salesPitch.callToAction || '';
        console.log('\n=== 実際の判定結果 ===');
        console.log('companyDesc.trim():', `"${companyDesc.trim()}"`);
        console.log('callAction.trim():', `"${callAction.trim()}"`);
        console.log('条件判定 (companyDesc.trim() || callAction.trim()):', !!(companyDesc.trim() || callAction.trim()));
      }
    } else {
      console.log('指定されたuserIdのAgentSettingsが見つかりません');
      
      // 全てのAgentSettingsを確認
      const allSettings = await AgentSettings.find({});
      console.log('\n=== 全AgentSettings ===');
      allSettings.forEach((s, i) => {
        console.log(`${i+1}. UserId: ${s.userId}, Company: ${s.conversationSettings?.companyName}`);
      });
    }

    await mongoose.disconnect();
  } catch (error) {
    console.error('エラー:', error);
  }
}

debugActualSettings();
