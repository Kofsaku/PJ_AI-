// app/api/twilio/voice/response/route.ts の例
import { NextResponse } from "next/server"
import twilio from "twilio"

const VoiceResponse = twilio.twiml.VoiceResponse

// 会話履歴を保存するためのメモリ内ストレージ（本番環境では永続化ストレージを使用すべき）
const conversationHistoryStore = new Map<string, string[]>();

// ChatGPTのAPIを呼び出す関数
async function getChatGPTResponse(userInput: string, callSid: string, step: string) {
  try {
    // 会話履歴を取得または初期化
    const conversationHistory = conversationHistoryStore.get(callSid) || [];
    
    // ユーザー入力を履歴に追加
    conversationHistory.push(`ユーザー: ${userInput}`);
    
    // ステップに応じたシステムプロンプトを設定
    let systemPrompt = "あなたは合同会社AIコールの営業担当です。AI関連のサービスを販売する電話営業をしています。顧客側の担当者につなげることが目的です。";
    
    switch(step) {
      case "1":
        systemPrompt += "初めての会話です。相手の反応を踏まえて、担当者につなぐよう促してください。担当者がいない場合は、いつなら都合が良いか聞いてください。";
        break;
      case "2":
        systemPrompt += "2回目の会話です。製品概要を簡潔に伝え、担当者に詳しい説明をしたいことを伝えてください。";
        break;
      case "3":
        systemPrompt += "最後の会話です。担当者につなぐ前に、なぜこのサービスがお客様の会社に有益かを簡潔に伝え、担当者に取り次ぐことを明確に伝えてください。";
        break;
    }
    
    // ステップ3では、担当者に繋ぐ意図を明確にする
    if (step === "3") {
      systemPrompt += "必ず「それでは、弊社の担当者におつなぎしますので、少々お待ちください。」という文で終わらせてください。";
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          ...conversationHistory.map(msg => ({
            role: msg.startsWith("ユーザー: ") ? "user" : "assistant",
            content: msg.replace(/^(ユーザー: |アシスタント: )/, "")
          })),
        ],
        max_tokens: 150,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      throw new Error(`ChatGPT API error: ${response.statusText}`)
    }

    const data = await response.json()
    const aiResponse = data.choices[0].message.content;
    
    // AIの応答を履歴に追加
    conversationHistory.push(`アシスタント: ${aiResponse}`);
    
    // 更新された履歴を保存
    conversationHistoryStore.set(callSid, conversationHistory);
    
    return aiResponse;
  } catch (error) {
    console.error("ChatGPT API error:", error)
    return "申し訳ありません。エラーが発生しました。少々お待ちください。"
  }
}

// 次のステップを計算する関数
function getNextStep(currentStep: string): string {
  const step = parseInt(currentStep);
  return (step < 3) ? (step + 1).toString() : "operator";
}

export async function POST(request: Request) {
  try {
    console.log("=== リクエスト受信 ===")
    console.log("URL:", request.url)
    console.log("Method:", request.method)
    console.log("NEXT_PUBLIC_APP_URL:", process.env.NEXT_PUBLIC_APP_URL)

    // リクエストヘッダーの確認
    const headers = Object.fromEntries(request.headers.entries())
    console.log("Headers:", JSON.stringify(headers, null, 2))

    // Twilioから送られる音声入力（SpeechResult）を取得
    const formData = await request.formData()
    console.log("=== FormData 内容 ===")
    for (const [key, value] of formData.entries()) {
      console.log(`${key}: ${value}`)
    }

    const speechResult = formData.get("SpeechResult")
    const confidence = formData.get("Confidence")
    const callSid = formData.get("CallSid")?.toString() || "unknown-call"
    const timestamp = new Date().toISOString()

    // 音声認識の信頼度チェック
    const confidenceValue = parseFloat(confidence?.toString() || "0")
    if (confidenceValue < 0.5) {
      console.log("音声認識の信頼度が低いため、再試行します")
      const response = new VoiceResponse()
      response.say({ voice: "Polly.Mizuki", language: "ja-JP" }, "申し訳ありません。もう一度お願いできますでしょうか？")
      response.gather({
        input: ["speech"],
        language: "ja-JP",
        timeout: 15,
        speechTimeout: "auto",
        action: `${process.env.NEXT_PUBLIC_APP_URL || 'https://pj-ai-2t27-olw2j2em4-kofsakus-projects.vercel.app'}/api/twilio/voice/response?state=initial`,
        method: "POST",
        // hints: "はい,いいえ,担当者,営業,お断り,ホームページ,また電話,失礼,結構"
      })
      return new NextResponse(response.toString(), {
        headers: { "Content-Type": "text/xml; charset=utf-8" },
      })
    }

    // URLからクエリパラメータの`state`を取得
    const { searchParams } = new URL(request.url)
    const state = searchParams.get("state") || "initial"
    const response = new VoiceResponse()
    
    // Base URLを一度だけ定義
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pj-ai-2t27-olw2j2em4-kofsakus-projects.vercel.app'
    console.log('Using base URL:', baseUrl)

    // ステートごとの応答ロジック
    switch (state) {
      case "initial":
        response.say({ voice: "Polly.Mizuki", language: "ja-JP" }, "すみません、実は本日、");
        response.say({ voice: "Polly.Mizuki", language: "ja-JP" }, "初めてお電話をさせていただきました！");
        response.gather({
          input: ["speech"],
          language: "ja-JP",
          timeout: 30,
          speechTimeout: "auto",
          action: `${baseUrl}/api/twilio/voice/response?state=second_response`,
          method: "POST",
          hints: "はい,ええ,"
        });
        break;
      case "first_response":
        response.say({ voice: "Polly.Mizuki", language: "ja-JP" }, "弊社は生成ＡＩを使った新規顧客獲得テレアポのサービスを提供している会社でございまして、");
        response.say({ voice: "Polly.Mizuki", language: "ja-JP" }, "是非、御社の営業の方にご案内できればと思いお電話をさせていただきました！");
        response.say({ voice: "Polly.Mizuki", language: "ja-JP" }, "本日、営業の担当者さまはいらっしゃいますでしょうか？");
        response.gather({
          input: ["speech"],
          language: "ja-JP",
          timeout: 30,
          speechTimeout: "auto",
          action: `${baseUrl}/api/twilio/voice/response?state=check_availability`,
          method: "POST",
          hints: "はい,いいえ,担当者,営業,お断り,ホームページ,また電話,失礼,結構,外出,会議,打ち合わせ,電話中,社名,会社名,どちら様"
        });
        break;
      case "second_response":
        response.say({ voice: "Polly.Mizuki", language: "ja-JP" }, "弊社は生成ＡＩを使った新規顧客獲得テレアポのサービスを提供している会社でございまして、");
        response.say({ voice: "Polly.Mizuki", language: "ja-JP" }, "是非、御社の営業の方にご案内できればと思いお電話をさせていただきました！");
        response.say({ voice: "Polly.Mizuki", language: "ja-JP" }, "本日、営業の担当者さまはいらっしゃいますでしょうか？");
        response.gather({
          input: ["speech"],
          language: "ja-JP",
          timeout: 30,
          speechTimeout: "auto",
          action: `${baseUrl}/api/twilio/voice/response?state=check_availability`,
          method: "POST",
          hints: "はい,いいえ,担当者,営業,お断り,ホームページ,また電話,失礼,結構,外出,会議,打ち合わせ,電話中"
        });
        break;
      case "check_availability":
        const userResponse = speechResult?.toString().toLowerCase() || "";
        
        if (userResponse.includes("社名") || userResponse.includes("会社名") || userResponse.includes("どちら様")) {
          response.say({ voice: "Polly.Mizuki", language: "ja-JP" }, "ＡＩコールシステムの安達と申します。");
          response.say({ voice: "Polly.Mizuki", language: "ja-JP" }, "本日、営業の担当者さまはいらっしゃいますでしょうか？");
          response.gather({
            input: ["speech"],
            language: "ja-JP",
            timeout: 30,
            speechTimeout: "auto",
            action: `${process.env.NEXT_PUBLIC_APP_URL || 'https://pj-ai-2t27-olw2j2em4-kofsakus-projects.vercel.app'}/api/twilio/voice/response?state=check_availability`,
            method: "POST",
            hints: "はい,いいえ,担当者,営業,お断り,ホームページ,また電話,失礼,結構,外出,会議,打ち合わせ,電話中"
          });
        } else if (userResponse.includes("外出") || userResponse.includes("会議") || 
                  userResponse.includes("打ち合わせ") || userResponse.includes("電話中") || 
                  userResponse.includes("席を外") || userResponse.includes("不在")) {
          response.say({ voice: "Polly.Mizuki", language: "ja-JP" }, "そうですか！");
          response.say({ voice: "Polly.Mizuki", language: "ja-JP" }, "ではまたタイミングをみてお電話させていただきます。");
          response.say({ voice: "Polly.Mizuki", language: "ja-JP" }, "ありがとうございました。");
          response.pause({ length: 5 });
          response.hangup();
        } else if (userResponse.includes("お断り") || userResponse.includes("結構") || 
                  userResponse.includes("失礼") || userResponse.includes("要らない")) {
          response.say({ voice: "Polly.Mizuki", language: "ja-JP" }, "そうですか！");
          response.say({ voice: "Polly.Mizuki", language: "ja-JP" }, "大変失礼を致しました。");
          response.say({ voice: "Polly.Mizuki", language: "ja-JP" }, "また何かございましたら、よろしくお願い致します。");
          response.pause({ length: 5 });
          response.hangup();
        } else if (userResponse.includes("ホームページ") || userResponse.includes("メール") || 
                  userResponse.includes("問い合わせ") || userResponse.includes("書き込み")) {
          response.say({ voice: "Polly.Mizuki", language: "ja-JP" }, "ではホームページから書き込みをさせていただきます。");
          response.say({ voice: "Polly.Mizuki", language: "ja-JP" }, "ありがとうございました。");
          response.pause({ length: 5 });
          response.hangup();
        } else if (userResponse.includes("はい") || userResponse.includes("担当者")) {
          response.redirect({
            method: "POST"
          }, `${baseUrl}/api/twilio/voice/connect/operator`);
        } else {
          response.say({ voice: "Polly.Mizuki", language: "ja-JP" }, "申し訳ありません。もう一度お願いできますでしょうか？");
          response.gather({
            input: ["speech"],
            language: "ja-JP",
            timeout: 30,
            speechTimeout: "auto",
            action: `${process.env.NEXT_PUBLIC_APP_URL || 'https://pj-ai-2t27-olw2j2em4-kofsakus-projects.vercel.app'}/api/twilio/voice/response?state=check_availability`,
            method: "POST",
            hints: "はい,いいえ,担当者,営業,お断り,ホームページ,また電話,失礼,結構,外出,会議,打ち合わせ,電話中"
          });
        }
        break;
      case "introduction":
        response.say({ voice: "Polly.Mizuki", language: "ja-JP" }, "弊社は生成ＡＩを使った新規顧客獲得テレアポのサービスでございまして、");
        response.say({ voice: "Polly.Mizuki", language: "ja-JP" }, "是非、御社の営業の方にご案内できればと思いお電話をさせていただきました！");
        response.say({ voice: "Polly.Mizuki", language: "ja-JP" }, "本日、営業の担当者さまはいらっしゃいますでしょうか？");
        response.gather({
          input: ["speech"],
          language: "ja-JP",
          timeout: 15,
          speechTimeout: "auto",
          action: `${process.env.NEXT_PUBLIC_APP_URL || 'https://pj-ai-2t27-olw2j2em4-kofsakus-projects.vercel.app'}/api/twilio/voice/response?state=check_availability`,
          method: "POST",
          hints: "はい,いいえ,担当者,営業,お断り,ホームページ,また電話,失礼,結構,外出,会議,打ち合わせ,電話中"
        });
        break;
      case "schedule_callback":
        const callbackTime = speechResult?.toString() || "";
        response.say({ voice: "Polly.Mizuki", language: "ja-JP" }, "ご指定いただいた時間に、改めてお電話させていただきます。");
        response.say({ voice: "Polly.Mizuki", language: "ja-JP" }, "ご対応いただき、ありがとうございました。");
        response.pause({ length: 2 });
        response.hangup();
        break;
      case "repeat_company":
        response.say({ voice: "Polly.Mizuki", language: "ja-JP" }, "ＡＩコールシステムの安達と申します。");
        response.gather({
          input: ["speech"],
          language: "ja-JP",
          timeout: 15,
          speechTimeout: "auto",
          action: `${baseUrl}/api/twilio/voice/response?state=introduction`,
          method: "POST",
          hints: "はい,いいえ,担当者,営業,お断り,ホームページ,また電話,失礼,結構"
        });
        break;
      case "unavailable":
        response.say({ voice: "Polly.Mizuki", language: "ja-JP" }, "そうですか！");
        response.say({ voice: "Polly.Mizuki", language: "ja-JP" }, "ではまたタイミングをみてお電話させていただきます。");
        response.say({ voice: "Polly.Mizuki", language: "ja-JP" }, "ありがとうございました。");
        response.pause({ length: 2 });
        response.hangup();
        break;
      case "rejection":
        response.say({ voice: "Polly.Mizuki", language: "ja-JP" }, "そうですか！");
        response.say({ voice: "Polly.Mizuki", language: "ja-JP" }, "大変失礼を致しました。");
        response.say({ voice: "Polly.Mizuki", language: "ja-JP" }, "また何かございましたら、よろしくお願い致します。");
        response.pause({ length: 2 });
        response.hangup();
        break;
      case "website":
        response.say({ voice: "Polly.Mizuki", language: "ja-JP" }, "ではホームページから書き込みをさせていただきます。");
        response.say({ voice: "Polly.Mizuki", language: "ja-JP" }, "ありがとうございました。");
        response.pause({ length: 2 });
        response.hangup();
        break;
      default:
        response.say({ voice: "Polly.Mizuki", language: "ja-JP" }, "申し訳ありません。もう一度お願いできますでしょうか？");
        response.gather({
          input: ["speech"],
          language: "ja-JP",
          timeout: 15,
          speechTimeout: "auto",
          action: `${baseUrl}/api/twilio/voice/response?state=initial`,
          method: "POST",
          // hints: "はい,いいえ,担当者,営業,お断り,ホームページ,また電話,失礼,結構"
        });
        break;
    }

    const twiml = response.toString()
    return new NextResponse(twiml, {
      headers: { "Content-Type": "text/xml; charset=utf-8" },
    })
  } catch (error) {
    console.error("=== エラー発生 ===")
    console.error("Error generating TwiML:", error)
    if (error instanceof Error) {
      console.error("Error stack:", error.stack)
    }
    
    // エラー発生時は謝罪メッセージを返す
    try {
      const errorResponse = new VoiceResponse()
      errorResponse.say({
        voice: "Polly.Mizuki",
        language: "ja-JP"
      }, "申し訳ありません。システムエラーが発生しました。担当者におつなぎします。少々お待ちください。")
      
      errorResponse.redirect({
        method: "POST"
      }, `${baseUrl}/api/twilio/voice/connect/operator`)
      
      return new NextResponse(errorResponse.toString(), {
        headers: { "Content-Type": "text/xml; charset=utf-8" },
      })
    } catch (nestedError) {
      console.error("=== 二次エラー発生 ===", nestedError)
      // 最終的なフォールバック - 空のレスポンスを返す
      return new NextResponse("<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response></Response>", {
        status: 200,
        headers: { "Content-Type": "text/xml; charset=utf-8" },
      })
    }
  }
}
