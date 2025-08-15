const AgentSettings = require('../models/AgentSettings');

class ConversationEngine {
  constructor() {
    // 応答パターンのキーワード定義
    this.responsePatterns = {
      silent: {
        keywords: [],
        confidence: 0.9,
        timeout: 3000 // 3秒間無音の場合
      },
      unclear: {
        keywords: ['はい', 'もしもし', 'はぁ', 'えっ', 'なに', '何', 'え？'],
        confidence: 0.7
      },
      company_inquiry: {
        keywords: ['どちら様', 'お名前', '会社名', 'どこの', '誰', 'だれ'],
        confidence: 0.8
      },
      absent: {
        keywords: ['不在', 'いない', 'いません', '席を外して', '出張', '会議中', '休み', '外出'],
        confidence: 0.85
      },
      rejection: {
        keywords: ['結構です', '必要ない', 'いらない', '興味ない', 'お断り', '営業お断り', '間に合って'],
        confidence: 0.9
      },
      website_redirect: {
        keywords: ['ホームページ', 'ウェブサイト', 'メール', 'HP', 'WEB', 'サイト', '資料送って'],
        confidence: 0.8
      },
      transfer_ready: {
        keywords: ['お願いします', 'いいですよ', '大丈夫です', '聞きます', '話を聞く', 'どうぞ', '繋いで'],
        confidence: 0.85
      },
      hold_request: {
        keywords: ['ちょっと待って', '少々お待ち', '待って', '後で', 'あとで', '今忙しい'],
        confidence: 0.8
      }
    };

    // 会話状態管理
    this.conversationStates = new Map();
  }

  // 会話を初期化
  initializeConversation(callId, agentSettings) {
    const state = {
      callId,
      currentPhase: 'initial',
      turnCount: 0,
      silentCount: 0,
      clarificationCount: 0,
      lastResponse: null,
      agentSettings,
      shouldHandoff: false,
      handoffReason: null
    };

    this.conversationStates.set(callId, state);
    return state;
  }

  // 音声認識結果を分類
  classifyResponse(speechText, callId) {
    const state = this.conversationStates.get(callId);
    if (!state) {
      return {
        intent: 'unknown',
        confidence: 0,
        shouldHandoff: false,
        nextAction: 'continue'
      };
    }

    // 無音または空の応答をチェック
    if (!speechText || speechText.trim() === '') {
      state.silentCount++;
      if (state.silentCount >= 2) {
        return {
          intent: 'silent',
          confidence: 1.0,
          shouldHandoff: false,
          nextAction: 'end_call'
        };
      }
      return {
        intent: 'silent',
        confidence: 1.0,
        shouldHandoff: false,
        nextAction: 'continue'
      };
    }

    state.silentCount = 0; // リセット
    const normalizedText = speechText.toLowerCase().trim();
    
    // 各パターンに対してマッチングを実行
    let bestMatch = {
      intent: 'unknown',
      confidence: 0,
      shouldHandoff: false,
      nextAction: 'continue'
    };

    for (const [intent, pattern] of Object.entries(this.responsePatterns)) {
      if (intent === 'silent') continue; // 無音は上で処理済み

      const matchScore = this.calculateMatchScore(normalizedText, pattern.keywords);
      if (matchScore > bestMatch.confidence) {
        bestMatch = {
          intent,
          confidence: matchScore,
          shouldHandoff: false,
          nextAction: 'continue'
        };
      }
    }

    // 意図に基づいてアクションを決定
    switch (bestMatch.intent) {
      case 'transfer_ready':
        bestMatch.shouldHandoff = true;
        bestMatch.nextAction = 'handoff';
        state.shouldHandoff = true;
        state.handoffReason = 'Customer ready for transfer';
        break;
      
      case 'rejection':
      case 'website_redirect':
        bestMatch.nextAction = 'end_call';
        break;
      
      case 'absent':
        bestMatch.nextAction = 'schedule_callback';
        break;
      
      case 'unclear':
        state.clarificationCount++;
        if (state.clarificationCount >= 3) {
          bestMatch.shouldHandoff = true;
          bestMatch.nextAction = 'handoff';
          state.handoffReason = 'Multiple clarifications needed';
        }
        break;
    }

    // 会話のターン数をチェック
    state.turnCount++;
    if (state.turnCount >= 10 && !bestMatch.shouldHandoff) {
      bestMatch.shouldHandoff = true;
      bestMatch.nextAction = 'handoff';
      state.handoffReason = 'Extended conversation';
    }

    state.lastResponse = bestMatch;
    this.conversationStates.set(callId, state);

    return bestMatch;
  }

  // キーワードマッチングスコアを計算
  calculateMatchScore(text, keywords) {
    if (!keywords || keywords.length === 0) return 0;

    let matchCount = 0;
    for (const keyword of keywords) {
      if (text.includes(keyword)) {
        matchCount++;
      }
    }

    return matchCount / keywords.length;
  }

  // 応答メッセージを生成
  async generateResponse(callId, intent, customVariables = {}) {
    const state = this.conversationStates.get(callId);
    if (!state || !state.agentSettings) {
      return this.getDefaultResponse(intent);
    }

    const agentSettings = await AgentSettings.findById(state.agentSettings._id);
    if (!agentSettings) {
      return this.getDefaultResponse(intent);
    }

    // テンプレートマッピング
    const templateMap = {
      'initial': 'initial',
      'unclear': 'clarification',
      'company_inquiry': 'company_confirmation',
      'absent': 'absent',
      'rejection': 'rejection',
      'website_redirect': 'website_redirect',
      'transfer_ready': 'handoff_message',
      'closing': 'closing'
    };

    const templateName = templateMap[intent] || 'initial';
    const response = agentSettings.processTemplate(templateName, customVariables);

    return response || this.getDefaultResponse(intent);
  }

  // デフォルト応答を取得
  getDefaultResponse(intent) {
    const defaultResponses = {
      initial: 'お世話になります。本日はサービスのご案内でお電話させていただきました。ご担当者様はいらっしゃいますでしょうか？',
      clarification: '申し訳ございません。もう一度お聞きしてもよろしいでしょうか？',
      company_inquiry: '私どもの会社名と申します。サービスのご案内でお電話しております。',
      absent: '承知いたしました。また改めてご連絡させていただきます。',
      rejection: '承知いたしました。お忙しい中失礼いたしました。',
      website_redirect: '承知いたしました。ホームページからお問い合わせいただければと思います。',
      handoff_message: '担当者におつなぎいたします。少々お待ちください。',
      closing: 'ありがとうございました。失礼いたします。',
      silent: 'お電話が遠いようですが、聞こえますでしょうか？'
    };

    return defaultResponses[intent] || defaultResponses.initial;
  }

  // 会話フローの次のステップを決定
  determineNextStep(callId, currentIntent) {
    const state = this.conversationStates.get(callId);
    if (!state) return 'continue';

    // 会話フローのステートマシン
    const flowTransitions = {
      initial: {
        transfer_ready: 'handoff',
        unclear: 'clarification',
        company_inquiry: 'company_confirmation',
        absent: 'schedule_callback',
        rejection: 'polite_end',
        website_redirect: 'provide_website',
        silent: 'check_connection'
      },
      clarification: {
        transfer_ready: 'handoff',
        unclear: 'handoff', // 複数回の確認が必要な場合は引き継ぎ
        rejection: 'polite_end',
        silent: 'check_connection'
      },
      company_confirmation: {
        transfer_ready: 'handoff',
        rejection: 'polite_end',
        unclear: 'clarification'
      }
    };

    const currentPhase = state.currentPhase || 'initial';
    const transitions = flowTransitions[currentPhase] || {};
    const nextStep = transitions[currentIntent] || 'continue';

    // ステート更新
    if (nextStep !== 'continue') {
      state.currentPhase = nextStep;
      this.conversationStates.set(callId, state);
    }

    return nextStep;
  }

  // 引き継ぎ判定
  shouldHandoffToHuman(callId) {
    const state = this.conversationStates.get(callId);
    if (!state) return false;

    // 引き継ぎ条件
    const handoffConditions = [
      state.shouldHandoff === true,
      state.turnCount >= 10,
      state.clarificationCount >= 3,
      state.lastResponse?.intent === 'transfer_ready'
    ];

    return handoffConditions.some(condition => condition === true);
  }

  // 会話分析レポートを生成
  generateConversationReport(callId) {
    const state = this.conversationStates.get(callId);
    if (!state) return null;

    return {
      callId,
      totalTurns: state.turnCount,
      silentResponses: state.silentCount,
      clarificationRequests: state.clarificationCount,
      finalIntent: state.lastResponse?.intent,
      handoffRecommended: state.shouldHandoff,
      handoffReason: state.handoffReason,
      conversationPhase: state.currentPhase
    };
  }

  // 会話状態をクリア
  clearConversation(callId) {
    this.conversationStates.delete(callId);
  }

  // カスタムインテント検出器を追加
  addCustomIntent(name, keywords, confidence = 0.8) {
    this.responsePatterns[name] = {
      keywords,
      confidence
    };
  }

  // 会話履歴から学習（将来の拡張用）
  async learnFromHistory(callSessions) {
    // 成功した会話パターンを分析
    const successfulPatterns = callSessions
      .filter(session => session.callResult === '成功')
      .map(session => ({
        transcript: session.transcript,
        duration: session.duration,
        handoffTime: session.handoffTime
      }));

    // パターン分析と最適化のロジックをここに実装
    // 現在はプレースホルダー
    return {
      patternsAnalyzed: successfulPatterns.length,
      optimizationsApplied: 0
    };
  }
}

module.exports = new ConversationEngine();