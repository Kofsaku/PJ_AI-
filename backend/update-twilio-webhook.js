require('dotenv').config();
const twilio = require('twilio');

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const updatePhoneNumber = async () => {
  try {
    const ngrokUrl = process.env.BASE_URL || 'https://21fe5a6abbaf.ngrok-free.app';
    
    // 使用する電話番号
    const phoneNumber = process.env.TWILIO_PHONE_NUMBER; // +16076956082
    
    // 電話番号リソースを取得
    const phoneNumbers = await client.incomingPhoneNumbers.list({
      phoneNumber: phoneNumber
    });
    
    if (phoneNumbers.length === 0) {
      console.error('電話番号が見つかりません:', phoneNumber);
      process.exit(1);
    }
    
    const phoneNumberSid = phoneNumbers[0].sid;
    console.log('電話番号SID:', phoneNumberSid);
    console.log('現在のVoice URL:', phoneNumbers[0].voiceUrl);
    
    // Webhook URLを更新
    const updatedNumber = await client.incomingPhoneNumbers(phoneNumberSid).update({
      voiceUrl: `${ngrokUrl}/api/twilio/voice`,
      voiceMethod: 'POST',
      statusCallback: `${ngrokUrl}/api/twilio/status`,
      statusCallbackMethod: 'POST'
    });
    
    console.log('\n✅ Twilioの電話番号設定が更新されました:');
    console.log('電話番号:', updatedNumber.phoneNumber);
    console.log('新しいVoice URL:', updatedNumber.voiceUrl);
    console.log('メソッド:', updatedNumber.voiceMethod);
    console.log('\n重要: ローカルテストが終わったら、元のURLに戻すことを忘れないでください！');
    console.log('元のURL: https://pj-ai-2t27-olw2j2em4-kofsakus-projects.vercel.app/api/twilio/voice');
    
  } catch (error) {
    console.error('エラー:', error);
    process.exit(1);
  }
};

updatePhoneNumber();