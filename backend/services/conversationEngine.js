const AgentSettings = require('../models/AgentSettings');

class ConversationEngine {
  constructor() {
    // call_logic.mdに完全準拠した応答パターン
    this.responsePatterns = {
      // A: 普通の応答（「はい」「お世話になります」）
      normal_response: {
        keywords: ['はい', 'お世話になります', 'どうぞ', '私です', '担当です'],
        confidence: 0.8
      },
      // B: 聞き返し（「はい？」）
      clarification_request: {
        keywords: ['はい？', 'もしもし？', 'えっ？', 'なんでしょう', '聞こえない', 'もう一度'],
        confidence: 0.85
      },
      // C: 社名確認（「もう一度社名を？」）
      company_confirmation: {
        keywords: ['社名', 'どちら様', '会社名', 'お名前', 'どこの', 'どちらから'],
        confidence: 0.85
      },
      // D: 担当者不在
      absent: {
        keywords: ['不在', 'いない', 'いません', '席を外し', '出張', '会議', '休み', '外出', '他の電話', 'おりません'],
        confidence: 0.85
      },
      // E: 新規電話お断り
      rejection: {
        keywords: ['お断り', '必要ない', 'いらない', '結構です', '営業お断り', '間に合って', '受け付けない'],
        confidence: 0.9
      },
      // F: HP/メール誘導
      website_redirect: {
        keywords: ['ホームページ', 'HP', 'Web', 'メール', 'サイト', 'フォーム', '問い合わせフォーム', 'ウェブ'],
        confidence: 0.85
      },
      // 用件確認
      purpose_inquiry: {
        keywords: ['ご用件', '用件は', 'どういった', 'なんの用', '何の件', 'どのような'],
        confidence: 0.85
      },
      // 終話の合図
      closing_signal: {
        keywords: ['失礼します', '失礼いたします', 'ありがとうございました', 'では失礼', 'それでは'],
        confidence: 0.9
      },
      // 無音
      silent: {
        keywords: [],
        confidence: 0.9,
        timeout: 2000 // 2秒間無音で自己紹介開始
      }
    };

    // 会話状態管理
    this.conversationStates = new Map();
  }

  // 会話を初期化
  initializeConversation(callId, agentSettings, forceReset = false) {
    // 既に存在する場合でも、forceResetがtrueなら再初期化
    if (this.conversationStates.has(callId) && !forceReset) {
      console.log(`[ConversationEngine] Conversation already exists for ${callId}, skipping initialization`);
      return this.conversationStates.get(callId);
    }
    
    // 既存の会話状態があれば削除（新しい通話のため）
    if (this.conversationStates.has(callId)) {
      console.log(`[ConversationEngine] Force resetting conversation for ${callId}`);
      this.conversationStates.delete(callId);
    }
    
    console.log(`[ConversationEngine] Initializing NEW conversation for ${callId}`);
    console.log(`[ConversationEngine] Agent settings:`, JSON.stringify(agentSettings, null, 2));
    
    if (!agentSettings) {
      console.error(`[ConversationEngine] ERROR: No agent settings provided for call ${callId}`);
      return null;
    }
    
    const state = {
      callId,
      currentPhase: 'INITIAL', // INITIAL: 初回待機状態
      turnCount: 0,
      silentCount: 0,
      clarificationCount: 0, // 聞き返し回数（1回まで）
      lastResponse: null,
      agentSettings,
      shouldHandoff: false,
      handoffReason: null,
      conversationHistory: [],
      lastSpeechTime: Date.now(),
      continuousSilentCount: 0,
      customerSpokeFirst: false,
      hasIntroduced: false, // 自己紹介済みフラグ
      hasGivenPurpose: false, // 用件説明済みフラグ
      waitingForClosing: false, // 終話待機中フラグ
      closingTimer: null // 終話タイマー
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

  // 音声認識結果を分類（call_logic.md準拠）
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
      
      // 初回の無音（2秒後）は自己紹介を開始
      if (!state.hasIntroduced && state.silentCount === 1) {
        console.log('[ConversationEngine] Initial silence detected - will introduce');
        return {
          intent: 'initial_silence',
          confidence: 1.0,
          shouldHandoff: false,
          nextAction: 'introduce'
        };
      }
      
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
    
    // call_logic.md に基づいた対応分岐
    switch (bestMatch.intent) {
      // D, E, F: 即終了パターン
      case 'absent':
        console.log('[ConversationEngine] 担当者不在 - 終話へ');
        state.currentPhase = 'CLOSING';
        bestMatch.nextAction = 'respond_and_end';
        break;
        
      case 'rejection':
        console.log('[ConversationEngine] 新規お断り - 終話へ');
        state.currentPhase = 'CLOSING';
        bestMatch.nextAction = 'respond_and_end';
        break;
        
      case 'website_redirect':
        console.log('[ConversationEngine] HP/メール誘導 - 終話へ');
        state.currentPhase = 'CLOSING';
        bestMatch.nextAction = 'respond_and_end';
        break;
      
      // B: 聞き返し（1回まで）
      case 'clarification_request':
        state.clarificationCount++;
        console.log(`[ConversationEngine] 聞き返し回数: ${state.clarificationCount}`);
        if (state.clarificationCount > 1) {
          // 2回目の聞き返しは諦めて終了
          console.log('[ConversationEngine] 聞き返し2回目 - 終了');
          bestMatch.intent = 'too_many_clarifications';
          bestMatch.nextAction = 'apologize_and_end';
          state.currentPhase = 'CLOSING';
        } else {
          // 1回目は再度説明
          bestMatch.nextAction = 'clarify';
        }
        break;
      
      // C: 社名確認
      case 'company_confirmation':
        console.log('[ConversationEngine] 社名確認要求');
        bestMatch.nextAction = 'confirm_company';
        break;
      
      // 用件確認への対応（10秒ピッチ）
      case 'purpose_inquiry':
        if (!state.hasGivenPurpose) {
          console.log('[ConversationEngine] 用件説明（10秒ピッチ）');
          state.hasGivenPurpose = true;
          bestMatch.nextAction = 'give_purpose';
        }
        break;
      
      // A: 通常の応答
      case 'normal_response':
        if (!state.hasIntroduced) {
          state.hasIntroduced = true;
        }
        bestMatch.nextAction = 'continue';
        break;
      
      // 終話の合図を検出
      case 'closing_signal':
        console.log('[ConversationEngine] 終話合図検出 - 0.7-1.2秒待機');
        state.waitingForClosing = true;
        bestMatch.nextAction = 'prepare_closing';
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
      return this.getDefaultResponse('absent', callId);
    }
    
    if (intent === 'rejection' || (state.conversationHistory.length > 0 && 
        state.conversationHistory[state.conversationHistory.length - 1].message?.includes('結構'))) {
      return this.getDefaultResponse('rejection', callId);
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
    
    // デフォルト応答を使用する（カスタマイズ設定を考慮）
    const finalResponse = this.getDefaultResponse(intent, callId);
    
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

  // デフォルト応答を取得（call_logic.md完全準拠）
  getDefaultResponse(intent, callId) {
    // callIdがあれば、agentSettingsから設定を取得してテンプレートを使用
    let templateResponse = null;
    if (callId) {
      const state = this.conversationStates.get(callId);
      if (state && state.agentSettings) {
        const AgentSettings = require('../models/AgentSettings');
        // AgentSettingsインスタンスとしてprocessTemplateメソッドを使用
        if (typeof state.agentSettings.processTemplate === 'function') {
          templateResponse = state.agentSettings.processTemplate(intent);
        } else {
          // agentSettingsがプレーンオブジェクトの場合、手動でテンプレート処理
          templateResponse = this.processTemplate(intent, state.agentSettings);
        }
      }
    }
    
    if (templateResponse) {
      return templateResponse;
    }
    
    const defaultResponses = {
      // 初回挨拶（call_logic.md: AIのオープニング）
      initial: 'お世話になります。{{companyName}}の{{representativeName}}と申します。{{serviceName}}のご案内でお電話しました。本日、{{targetDepartment}}のご担当者さまはいらっしゃいますでしょうか？',
      
      // B: 聞き返し対応（社名と目的を短く言い直す）
      clarification: '{{companyName}}の{{representativeName}}です。{{serviceName}}のご案内でお電話しました。{{targetDepartment}}のご担当者さまはいらっしゃいますでしょうか？',
      
      // C: 社名確認への応答
      company_confirmation: '{{companyName}}の{{representativeName}}です。',
      
      // D: 不在対応
      absent: '承知しました。では、また改めてお電話いたします。ありがとうございました。',
      
      // E: 新規電話お断り対応
      rejection: '承知いたしました。本日は突然のご連絡、失礼いたしました。よろしくお願いいたします。',
      
      // F: HP/メール誘導対応
      website_redirect: '承知しました。御社ホームページの問い合わせフォームからご連絡いたします。ありがとうございました。',
      
      // 用件説明（10秒ピッチ）
      purpose_inquiry: 'ありがとうございます。{{companyDescription}} {{callToAction}}',
      
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
      
      // 終話
      closing: '本日はありがとうございました。失礼いたします。',
      
      // 初回無音時の自己紹介（2秒待機後）
      initial_silence: 'お世話になります。{{companyName}}の{{representativeName}}と申します。{{serviceName}}のご案内でお電話しました。本日、{{targetDepartment}}のご担当者さまはいらっしゃいますでしょうか？',
      
      // 聞き返しが多すぎる場合
      too_many_clarifications: '申し訳ございません。音声が聞き取りづらいようでしたら、後日改めてご連絡いたします。ありがとうございました。',
      
      // その他
      silent: 'お客様、お聞きになれますか？',
      unknown: '申し訳ございません。もう一度お聞きしてもよろしいでしょうか？'
    };

    // テンプレート処理が必要な応答は処理
    const response = defaultResponses[intent] || defaultResponses.unknown;
    
    // 変数を置換（簡易版）
    if (callId && response.includes('{{')) {
      const state = this.conversationStates.get(callId);
      if (state && state.agentSettings) {
        return this.processTemplate(intent, state.agentSettings) || response;
      }
    }
    
    return response;
  }

  // 手動でテンプレート処理を行う
  processTemplate(templateName, agentSettings) {
    const templates = {
      purpose_inquiry: 'sales_pitch', // purpose_inquiry用にsales_pitchテンプレートを使用
      company_inquiry: 'company_confirmation',
      service_detail: 'sales_pitch_short'
    };
    
    const actualTemplateName = templates[templateName] || templateName;
    
    // デフォルトのテンプレート定義
    const defaultTemplates = {
      sales_pitch: 'ありがとうございます。{{companyDescription}} {{callToAction}}',
      sales_pitch_short: '詳しくは、{{serviceDescription}} {{callToAction}}',
      company_confirmation: '{{companyName}}でございます。{{representativeName}}です。'
    };
    
    const template = defaultTemplates[actualTemplateName];
    if (!template) return null;
    
    // 変数の値を取得（call_logic.md準拠のデフォルト値）
    const vars = {
      companyName: agentSettings.companyName || 'AIコールシステム株式会社',
      serviceName: agentSettings.serviceName || 'AIアシスタントサービス',
      representativeName: agentSettings.representativeName || '佐藤',
      targetDepartment: agentSettings.targetDepartment || '営業部',
      companyDescription: agentSettings.salesPitch?.companyDescription || '弊社では、AIアシスタントサービスを提供しております。AIが一次架電を行い、見込み度の高いお客様だけを営業におつなぎする仕組みです。',
      serviceDescription: agentSettings.salesPitch?.serviceDescription || '（1）AIが自動で一次架電→要件把握、（2）見込み度スコアで仕分け、（3）高確度のみ人の営業に引き継ぎ、という流れです。架電の無駄を削減し、商談化率の向上に寄与します。',
      callToAction: agentSettings.salesPitch?.callToAction || 'ぜひ御社の営業部ご担当者さまに概要をご案内できればと思いまして。'
    };
    
    // テンプレート変数を置換
    let processed = template;
    Object.keys(vars).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      processed = processed.replace(regex, vars[key]);
    });
    
    return processed;
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

  // 終話待機処理（0.7〜1.2秒待機）
  async handleClosingWithDelay(callId, callback) {
    const state = this.conversationStates.get(callId);
    if (!state) return;
    
    // 0.7〜1.2秒のランダム待機時間
    const waitTime = Math.floor(Math.random() * 500 + 700); // 700-1200ms
    console.log(`[ConversationEngine] 終話待機: ${waitTime}ms`);
    
    state.waitingForClosing = true;
    state.closingTimer = setTimeout(() => {
      console.log('[ConversationEngine] 終話待機完了 - 通話終了');
      if (callback && typeof callback === 'function') {
        callback();
      }
      this.clearConversation(callId);
    }, waitTime);
    
    this.conversationStates.set(callId, state);
  }
  
  // 会話状態をクリア
  clearConversation(callId) {
    console.log(`[ConversationEngine] Clearing conversation state for ${callId}`);
    const state = this.conversationStates.get(callId);
    
    // 終話タイマーがあればクリア
    if (state && state.closingTimer) {
      clearTimeout(state.closingTimer);
    }
    
    this.conversationStates.delete(callId);
  }
  
  // 新しい通話のために会話履歴を完全にリセット
  resetConversationForNewCall(callId, agentSettings) {
    console.log(`[ConversationEngine] Resetting conversation for new call: ${callId}`);
    // 既存の状態を完全に削除
    this.clearConversation(callId);
    // 新しい状態を作成
    return this.initializeConversation(callId, agentSettings, true);
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