const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.isInitialized = false;
    this.initPromise = this.init();
  }

  async init() {
    // SMTP設定（環境変数から取得）
    if (process.env.NODE_ENV === 'development' && (!process.env.SMTP_USER || !process.env.SMTP_PASS)) {
      // 開発環境でSMTP設定がない場合、Ethereal Emailを使用
      console.log('Using Ethereal Email for development testing...');
      try {
        const testAccount = await nodemailer.createTestAccount();
        this.transporter = nodemailer.createTransport({
          host: testAccount.smtp.host,
          port: testAccount.smtp.port,
          secure: testAccount.smtp.secure,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
        console.log('Ethereal Email configured:');
        console.log('- Host:', testAccount.smtp.host);
        console.log('- User:', testAccount.user);
        console.log('- Pass:', testAccount.pass);
        console.log('- Preview URL will be shown after sending emails');
      } catch (error) {
        console.error('Failed to create test account:', error);
        // フォールバック：ログ出力のみ
        this.transporter = null;
      }
    } else {
      // 本番環境または設定済みの環境
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
    }
    this.isInitialized = true;
  }

  // 認証コードメール送信
  async sendVerificationCode(email, verificationCode, companyName = '') {
    try {
      // 初期化待ち
      if (!this.isInitialized) {
        await this.initPromise;
      }

      // トランスポーターがない場合（フォールバック）
      if (!this.transporter) {
        console.log('=== DEVELOPMENT EMAIL FALLBACK ===');
        console.log(`To: ${email}`);
        console.log(`Subject: [AI Call System] メールアドレス認証のお願い`);
        console.log(`Verification Code: ${verificationCode}`);
        console.log(`Company: ${companyName}`);
        console.log('================================');
        return {
          success: true,
          messageId: 'dev-fallback-' + Date.now(),
        };
      }

      const mailOptions = {
        from: process.env.EMAIL_FROM || process.env.SMTP_USER || 'noreply@aicallsystem.com',
        to: email,
        subject: '[AI Call System] メールアドレス認証のお願い',
        html: this.getVerificationEmailTemplate(verificationCode, companyName),
      };

      console.log('Sending verification email to:', email);
      const result = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', result.messageId);
      
      // Ethereal Emailの場合、プレビューURLを表示
      if (process.env.NODE_ENV === 'development') {
        const previewUrl = nodemailer.getTestMessageUrl(result);
        if (previewUrl) {
          console.log('📧 Email Preview URL:', previewUrl);
          console.log('   このURLでメールの内容を確認できます');
        }
      }
      
      return {
        success: true,
        messageId: result.messageId,
        previewUrl: nodemailer.getTestMessageUrl(result),
      };
    } catch (error) {
      console.error('Email sending failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // 認証コードメールテンプレート
  getVerificationEmailTemplate(verificationCode, companyName) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>メールアドレス認証</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2c3e50;">AI Call System</h2>
          <h3 style="color: #34495e;">メールアドレス認証のお願い</h3>
          
          <p>お疲れ様です。</p>
          
          ${companyName ? `<p><strong>${companyName}</strong> への登録ありがとうございます。</p>` : ''}
          
          <p>この度は当システムにご登録いただき、ありがとうございます。<br>
          以下の認証コードを入力してメールアドレス認証を完了してください。</p>
          
          <div style="background-color: #f8f9fa; border: 2px solid #e9ecef; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
            <h2 style="color: #495057; font-size: 32px; letter-spacing: 4px; margin: 0;">
              ${verificationCode}
            </h2>
          </div>
          
          <p><strong>※このコードは10分間有効です。</strong></p>
          <p>※このメールに心当たりがない場合は、このメールを無視してください。</p>
          
          <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">
          
          <p style="font-size: 14px; color: #6c757d;">
            このメールは AI Call System から自動送信されています。<br>
            このメールに返信されても回答できませんのでご了承ください。
          </p>
        </div>
      </body>
      </html>
    `;
  }

  // SMTP設定テスト
  async testConnection() {
    try {
      await this.transporter.verify();
      console.log('SMTP connection successful');
      return { success: true };
    } catch (error) {
      console.error('SMTP connection failed:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new EmailService();