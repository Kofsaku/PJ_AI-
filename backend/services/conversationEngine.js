const AgentSettings = require('../models/AgentSettings');

class ConversationEngine {
  constructor() {
    // call_logic.mdに基づいた応答パターン
    this.responsePatterns = {
      // P1-A: そのまま取次ぎ可
      transfer_ready: {
        keywords: ['おつなぎします', '繋ぎます', 'お待ちください', '少々お待ち'],
        confidence: 0.85
      },
      // P1-B: 英語担当者確認
      english_inquiry: {
        keywords: ['英語担当', 'English', '英語で', '英語の方'],
        confidence: 0.8
      },
      // P1-C: 用件確認
      purpose_inquiry: {
        keywords: ['ご用件', '用件は', 'どういった', 'なんの用', '何の件'],
        confidence: 0.85
      },
      // P2-A: 社名確認
      company_inquiry: {
        keywords: ['どちら様', '会社名', 'お名前', '社名は', 'どこの'],
        confidence: 0.8
      },
      // P3-A: 不在
      absent: {
        keywords: ['不在', 'いない', 'いません', '席を外し', '出張', '会議中', '休み', '外出', '他の電話'],
        confidence: 0.85
      },
      // P3-B: 新規電話拒否
      rejection: {
        keywords: ['受け付けない', '必要ない', 'いらない', '結構です', 'お断り', '営業お断り', '間に合って'],
        confidence: 0.9
      },
      // P3-C: Web/メール指定
      website_redirect: {
        keywords: ['ホームページ', 'ウェブ', 'メール', 'HP', 'Web', 'サイト', 'フォーム', '問い合わせフォーム'],
        confidence: 0.8
      },
      // 担当者確認
      is_responsible_person: {
        keywords: ['私が担当', '担当です', '本人です', '私です', 'わたしが'],
        confidence: 0.9
      },
      // 相手が名乗った
      greeting: {
        keywords: ['です', 'と申します', 'お電話ありがとう'],
        confidence: 0.7
      },
      silent: {
        keywords: [],
        confidence: 0.9,
        timeout: 2000 // 2秒間無音
      }
    };

    // 会話状態管理
    this.conversationStates = new Map();
  }

  // 会話を初期化
  initializeConversation(callId, agentSettings) {
    // 既に存在する場合は初期化しない
    if (this.conversationStates.has(callId)) {
      console.log(`[ConversationEngine] Conversation already exists for ${callId}, skipping initialization`);
      return this.conversationStates.get(callId);
    }
    
    console.log(`[ConversationEngine] Initializing NEW conversation for ${callId}`);
    console.log(`[ConversationEngine] Agent settings:`, JSON.stringify(agentSettings, null, 2));
    
    if (!agentSettings) {
      console.error(`[ConversationEngine] ERROR: No agent settings provided for call ${callId}`);
      return null;
    }
    
    const state = {
      callId,
      currentPhase: 'S0', // S0: 初回待機状態
      turnCount: 0,
      silentCount: 0,
      clarificationCount: 0,
      lastResponse: null,
      agentSettings,
      shouldHandoff: false,
      handoffReason: null,
      conversationHistory: [],
      lastSpeechTime: Date.now(),
      continuousSilentCount: 0,
      customerSpokeFirst: false,
      askedFor10SecPitch: false,
      askedFor30SecDetail: false
    };

    this.conversationStates.set(callId, state);
    console.log(`[ConversationEngine] Successfully initialized conversation for ${callId}`);
    return state;
  }
  
  // 会話が存在するか確認
  hasConversation(callId) {
    return this.conversationStates.has(callId);
  }
  
  // 会話状態を更新
  updateConversationState(callId, updates) {
    const state = this.conversationStates.get(callId);
    if (state) {
      Object.assign(state, updates);
      this.conversationStates.set(callId, state);
    }
  }
  
  // 会話状態を取得
  getConversationState(callId) {
    return this.conversationStates.get(callId);
  }

  // 音声認識結果を分類
  classifyResponse(speechText, callId) {
    console.log(`[ConversationEngine] Classifying response for callId: ${callId}`);
    console.log(`[ConversationEngine] Speech text: "${speechText}"`);
    
    const state = this.conversationStates.get(callId);
    if (!state) {
      console.log(`[ConversationEngine] No state found for callId: ${callId}`);
      return {
        intent: 'unknown',
        confidence: 0,
        shouldHandoff: false,
        nextAction: 'continue'
      };
    }

    // 無音または空の応答をチェック
    if (!speechText || speechText.trim() === '') {
      state.continuousSilentCount++;
      state.silentCount++;
      
      // 連続して3回以上無音の場合のみ通話終了
      if (state.continuousSilentCount >= 3) {
        return {
          intent: 'silent_end',
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

    // 音声入力があった場合、連続無音カウントをリセット
    state.continuousSilentCount = 0;
    state.lastSpeechTime = Date.now();
    
    // 会話履歴に追加
    state.conversationHistory.push({
      speaker: 'customer',
      message: speechText,
      timestamp: Date.now()
    });
    
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

    console.log(`[ConversationEngine] Best match intent: ${bestMatch.intent}, confidence: ${bestMatch.confidence}`);
    
    // 意図に基づいてアクションを決定
    switch (bestMatch.intent) {
      case 'transfer_ready':
        console.log(`[ConversationEngine] Customer ready for transfer`);
        bestMatch.shouldHandoff = true;
        bestMatch.nextAction = 'handoff';
        state.shouldHandoff = true;
        state.handoffReason = 'Customer ready for transfer';
        break;
      
      case 'rejection':
      case 'website_redirect':
        console.log(`[ConversationEngine] Customer rejected or requested website - ending call`);
        bestMatch.nextAction = 'end_call';
        break;
      
      case 'absent':
        bestMatch.nextAction = 'schedule_callback';
        break;
      
      case 'is_responsible_person':
        console.log(`[ConversationEngine] Customer confirmed they are the responsible person`);
        bestMatch.nextAction = 'continue';
        bestMatch.intent = 'purpose_inquiry';  // 10秒ピッチに移行
        state.currentPhase = 'S2';  // 用件確認フェーズへ
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
    console.log(`[ConversationEngine] Generating response for call ${callId}, intent: ${intent}`);
    
    const state = this.conversationStates.get(callId);
    if (!state) {
      console.error(`[ConversationEngine] ERROR: No conversation state found for call ${callId}`);
      // 初期応答を返す
      return this.getDefaultInitialResponse();
    }
    
    if (!state.agentSettings) {
      console.error(`[ConversationEngine] ERROR: No agent settings in state for call ${callId}`);
      // 初期応答を返す
      return this.getDefaultInitialResponse();
    }
    
    // 最初の顧客の発話（もしもし等）には、通常の挨拶で応答
    if (state.turnCount === 0 || (state.customerSpokeFirst && state.turnCount === 1)) {
      console.log(`[ConversationEngine] First customer interaction - providing initial greeting`);
      const { companyName, serviceName, representativeName, targetDepartment } = state.agentSettings;
      if (companyName && representativeName && serviceName && targetDepartment) {
        const initialMessage = `お世話になります。${companyName}の${representativeName}と申します。${serviceName}のご案内でお電話しました。本日、${targetDepartment}のご担当者さまはいらっしゃいますでしょうか？`;
        return initialMessage;
      }
      return this.getDefaultInitialResponse();
    }
    
    // 「不在」「結構です」への適切な応答
    if (intent === 'absent' || (state.conversationHistory.length > 0 && 
        state.conversationHistory[state.conversationHistory.length - 1].message?.includes('不在'))) {
      return this.getDefaultResponse('absent');
    }
    
    if (intent === 'rejection' || (state.conversationHistory.length > 0 && 
        state.conversationHistory[state.conversationHistory.length - 1].message?.includes('結構'))) {
      return this.getDefaultResponse('rejection');
    }

    // agentSettingsから直接設定を取得
    let agentSettings = state.agentSettings;
    
    // 設定から最初の応答を作成
    if (intent === 'initial' || intent === 'silent') {
      const { companyName, serviceName, representativeName, targetDepartment } = agentSettings;
      if (companyName && representativeName && serviceName && targetDepartment) {
        const initialMessage = `お世話になります。${companyName}の${representativeName}と申します。${serviceName}のご案内でお電話しました。本日、${targetDepartment}のご担当者さまはいらっしゃいますでしょうか？`;
        console.log(`[ConversationEngine] Generated initial message: ${initialMessage}`);
        return initialMessage;
      }
    }
    
    // デフォルト応答を使用する（processTemplateは存在しない可能性があるため）
    const finalResponse = this.getDefaultResponse(intent);
    
    // AI応答を会話履歴に追加
    if (state && finalResponse) {
      state.conversationHistory.push({
        speaker: 'ai',
        message: finalResponse,
        timestamp: Date.now()
      });
    }

    return finalResponse;
  }

  // デフォルトの初期応答を取得
  getDefaultInitialResponse() {
    return 'お世話になります。AIコールシステム株式会社の佐藤と申します。AIアシスタントサービスのご案内でお電話しました。本日、営業部のご担当者さまはいらっしゃいますでしょうか？';
  }

  // デフォルト応答を取得（call_logic.mdに基づく）
  getDefaultResponse(intent) {
    const defaultResponses = {
      // P0: 開始
      initial: 'お世話になります。AIコールシステム株式会社の佐藤と申します。AIアシスタントサービスのご案内でお電話しました。本日、営業部のご担当者さまはいらっしゃいますでしょうか？',
      
      // P1-A: 取次ぎ可
      transfer_ready: 'ありがとうございます。よろしくお願いいたします。',
      
      // P1-B: 英語担当確認
      english_inquiry: 'はい、可能です。まずは日本語で大丈夫です。ご担当者さまに概要だけお伝えできれば幸いです。',
      
      // P1-C: 用件確認（10秒ピッチ）
      purpose_inquiry: 'ありがとうございます。AIコールシステム株式会社では、生成AIを使った新規顧客獲得テレアポ支援により、AIが一次架電と仕分けを行い、見込み度の高いお客さまだけを営業におつなぎする仕組みをご提供しています。御社の営業部ご担当者さまに、概要だけご説明させていただけますか？',
      
      // P2-A: 社名確認
      company_inquiry: 'AIコールシステム株式会社でございます。担当は佐藤です。',
      
      // P2-B: 30秒詳細
      service_detail: '詳しくは、（1）AIが自動で一次架電→要件把握、（2）見込み度スコアで仕分け、（3）高確度のみ人の営業に引き継ぎ、という流れです。架電の無駄を削減し、商談化率の向上に寄与します。ご担当者さまに5分ほどで概要をご説明できますが、おつなぎ可能でしょうか。',
      
      // P3-A: 不在
      absent: '承知しました。では、また改めてお電話いたします。ありがとうございます。',
      
      // P3-B: 新規拒否
      rejection: '承知いたしました。突然のご連絡、失礼いたしました。ありがとうございます。',
      
      // P3-C: Web/メール指定
      website_redirect: '承知しました。御社の問い合わせフォーム（またはメール）からご連絡いたします。ありがとうございます。',
      
      // P4: 終話
      closing: '本日はありがとうございました。失礼いたします。',
      
      // その他
      silent: 'お客様、お聞きになれますか？',
      clarification: '申し訳ございません。もう一度お聞きしてもよろしいでしょうか？',
      is_responsible_person: 'ありがとうございます。それでは、AIアシスタントサービスについて簡単にご説明させていただきます。',
      unknown: '申し訳ございません。もう一度お聞きしてもよろしいでしょうか？'
    };

    return defaultResponses[intent] || defaultResponses.clarification;
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