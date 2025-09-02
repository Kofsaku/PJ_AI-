/**
 * テンプレート統一設定ファイル
 * 全てのインテント→テンプレートマッピングとデフォルトテンプレートを管理
 */

// インテント名 → AgentSettingsのテンプレート名のマッピング
const intentToTemplate = {
  // 肯定的応答系
  normal_response: 'positive_response',
  positive_response: 'positive_response',
  
  // 担当者変更・転送系
  person_changed: 'transfer_explanation',
  transfer_explanation: 'transfer_explanation',
  prepare_transfer: 'prepare_transfer',
  transfer_wait: 'positive_response',
  transfer_confirm: 'positive_response',
  transfer_handover: 'positive_response',
  
  // 転送確定（サービス説明後の同意）
  transfer_agreement: 'transfer_confirmed',
  
  // セールス・説明系
  purpose_inquiry: 'sales_pitch',
  
  // 確認・問い合わせ系
  company_inquiry: 'company_confirmation',
  clarification_request: 'clarification',
  
  // 終了系
  absent: 'absent',
  rejection: 'rejection',
  website_redirect: 'website_redirect',
  closing: 'closing',
  
  // その他
};

// フォールバック用デフォルトテンプレート定義
const defaultTemplates = {
  // セールス系
  sales_pitch: 'ありがとうございます。{{companyDescription}} {{callToAction}}',
  
  // 確認・問い合わせ系
  company_confirmation: '{{companyName}}でございます。{{representativeName}}です。',
  clarification: '失礼しました。{{companyName}}の{{representativeName}}です。{{serviceName}}についてご担当者さまにご案内の可否を伺っております。',
  
  // 肯定的応答系
  positive_response: 'ありがとうございます。よろしくお願いいたします。',
  
  // 転送・説明系
  transfer_explanation: 'お忙しいところすみません。{{selfIntroduction}}。弊社は{{serviceDescription}}会社でございます。\n\nこれより直接担当者から詳細をご説明させて頂いてもよろしいでしょうか？\nお構いなければAIコールシステムから弊社の担当者に取り次ぎのうえご説明申し上げます。',
  prepare_transfer: 'ありがとうございます。よろしくお願いいたします。',
  
  // 終了系
  absent: '承知しました。では、また改めてお電話いたします。ありがとうございました。',
  rejection: '承知いたしました。本日は突然のご連絡、失礼いたしました。よろしくお願いいたします。',
  website_redirect: '承知しました。御社ホームページの問い合わせフォームからご連絡いたします。ありがとうございました。',
  closing: '本日はありがとうございました。失礼いたします。',
  
  // 転送確定系
  transfer_confirmed: 'ありがとうございます。転送いたしますので少々お待ち下さい。',
  
  // その他
  
  // システム応答
  initial: 'お世話になります。AIコールシステム株式会社です。営業部のご担当者さまはいらっしゃいますでしょうか？',
  unknown: '申し訳ございません。もう一度お聞きしてもよろしいでしょうか？'
};

// 必須テンプレート一覧（バリデーション用）
const requiredTemplates = [
  'positive_response',
  'transfer_explanation', 
  'prepare_transfer',
  'sales_pitch',
  'company_confirmation',
  'absent',
  'rejection',
  'website_redirect',
  'closing',
  'unknown'
];

// AgentSettingsで管理されるべきテンプレート一覧
const agentSettingsTemplates = [
  'initial',
  'clarification',
  'company_confirmation',
  'absent',
  'rejection',
  'website_redirect',
  'closing',
  'sales_pitch',
  'positive_response',
  'transfer_explanation',
  'prepare_transfer',
  'transfer_confirmed'
];

// グローバルキーワード（いつでも優先的に処理）
const globalPatterns = {
  // 即終了系（最優先）
  rejection: {
    keywords: ['お断り', '必要ない', 'いらない', '結構です', '営業お断り', '間に合って', '受け付けない', '遠慮します', 'お断りします', '今回は見送ります', '興味ない', '必要ありません', '迷惑', '間に合っています'],
    confidence: 0.9,
    priority: 1
  },
  absent: {
    keywords: ['不在', 'いない', 'いません', '席を外し', '出張', '会議', '休み', '外出', '他の電話', 'おりません'],
    confidence: 0.85,
    priority: 1
  },
  website_redirect: {
    keywords: ['ホームページ', 'HP', 'Web', 'メール', 'サイト', 'フォーム', '問い合わせフォーム', 'ウェブ', '新規のご提案', 'ホームページから', 'サイトから', 'ウェブから'],
    confidence: 0.85,
    priority: 1
  }
};

// 文脈依存キーワード（会話の状態に応じて有効化）
const contextualPatterns = {
  // 初回質問直後のみ（「担当者はいらっしゃいますか？」への応答）
  afterInitialQuestion: {
    normal_response: {
      keywords: ['はい', 'います', 'おります'],
      confidence: 0.5
    },
    transfer_wait: {
      keywords: ['少々お待ち', 'お待ちください', '少しお待ち'],
      confidence: 0.6
    },
    transfer_confirm: {
      keywords: ['確認します', '確認いたします'],
      confidence: 0.6
    },
    transfer_handover: {
      keywords: ['担当者を', '担当の者に', '代わります', '変わります', '呼んでき', '聞いてき'],
      confidence: 0.6
    },
    clarification_request: {
      keywords: ['はい？', 'もしもし？', 'えっ？', 'なんでしょう', '聞こえない', 'もう一度教えて', 'もう一度説明', '再度教えて', '聞き取れない', '聞こえませんでした', '聞こえません'],
      confidence: 0.85
    },
    company_confirmation: {
      keywords: ['社名', 'どちら様', '会社名', 'お名前', 'どこの', 'どちらから', 'もう一度社名を', '社名をもう一度', '会社名をもう一度', 'もう一度お聞かせ願えますか'],
      confidence: 0.9
    }
  },

  // 社名確認後の状態
  afterCompanyConfirmation: {
    purpose_inquiry: {
      keywords: ['ご用件', '用件は', 'どういった', 'なんの用', '何の件', 'どのような', 'どんな'],
      confidence: 0.85
    },
    normal_response: {
      keywords: ['はい', 'お世話になります', 'どうぞ', 'よろしく'],
      confidence: 0.8
    }
  },
  
  // 用件説明直後の状態
  afterPurposeExplanation: {
    // 転送説明後の同意（実際に転送を実行）
    transfer_agreement: {
      keywords: ['わかりました', '分かりました', 'お願いします', 'はい、お願いします', 'よろしくお願いします', 'お話聞かせてください', '進めてください', 'いいですよ', '大丈夫です'],
      confidence: 0.9
    },
    clarification_request: {
      keywords: ['はい？', 'もしもし？', 'えっ？', 'なんでしょう', '聞こえない', 'もう一度教えて', 'もう一度説明', '再度教えて', '聞き取れない', '聞こえませんでした', '聞こえません', 'もう一度お願いします'],
      confidence: 0.85
    }
  },

  // 取次待ち状態（取次確定後）
  waitingForTransfer: {
    person_changed: {
      keywords: ['変わりました', '代わりました', '担当の', 'です', 'と申します', 'もしもし'],
      confidence: 0.7
    },
    transfer_confirmed: {
      keywords: ['確認します', '確認いたします'],
      confidence: 0.8
    }
  }
};

// 会話状態の定義
const conversationStates = {
  INITIAL: 'initial',                           // 初期状態
  AFTER_INITIAL_QUESTION: 'afterInitialQuestion',     // 初回質問直後
  AFTER_COMPANY_CONFIRMATION: 'afterCompanyConfirmation', // 社名確認後
  AFTER_PURPOSE_EXPLANATION: 'afterPurposeExplanation',   // 用件説明直後
  WAITING_FOR_TRANSFER: 'waitingForTransfer',  // 取次待ち
  CLOSING: 'closing'                           // 終話処理中
};

module.exports = {
  intentToTemplate,
  defaultTemplates,
  requiredTemplates,
  agentSettingsTemplates,
  globalPatterns,
  contextualPatterns,
  conversationStates
};