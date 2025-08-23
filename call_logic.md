

# 前提・変数

* `{{my_company_name}}`：発信側会社名
* `{{my_representative_name}}`：担当者名
* `{{my_service_name}}`：サービス名（例：生成AIを使った新規顧客獲得テレアポ支援）
* `{{callee_department}}`：相手部署名（例：営業部）

**サイレンス制御**

* 相手が無言：**2.0秒**待機 → AIが先に名乗る
* 質問後待機：**1.5秒**（無反応なら1回だけ言い換え）
* 終話：相手の「失礼します」後 **0.7–1.2秒**で切断

---

# パターン分岐（会話テンプレ）

## P0. 開始（相手が名乗る or 無言）

* 相手が名乗る → P1へ
* 無言（2秒） → AIが開始してP1へ

**AI（開始共通）**

* JP：「お世話になります。{{my\_company\_name}} の {{my\_representative\_name}} と申します。{{my\_service\_name}} のご案内でお電話しました。本日、{{callee\_department}} のご担当者さまはいらっしゃいますでしょうか？」
* EN: “Hello, this is {{my\_representative\_name}} from {{my\_company\_name}}. I’m calling regarding {{my\_service\_name}}. May I speak with someone from your {{callee\_department}}?”

---

## P1. 取次ぎ確認への応答バリエーション

### P1-A そのまま取次ぎ可（在席）

* 相手：「おつなぎします」
* AI：

  * JP：「ありがとうございます。よろしくお願いいたします。」
  * EN: “Thank you, I appreciate it.”

→ 転送後は再度「要件の超要約」から入る（P2-Bへ）

---

### P1-B 英語担当がいるか確認された

* 相手：「英語担当者はいますか？」
* AI：

  * JP：「はい、可能です。まずは日本語で大丈夫です。ご担当者さまに概要だけお伝えできれば幸いです。」
  * EN: “Yes, that’s possible. Japanese is fine as well. I’d be grateful to briefly share the overview with the right person.”

> ねらい：英語切替を求められても通話継続を阻害せず、**まずは日本語で概要→取次**へ誘導

---

### P1-C 「どういったご用件ですか？」（用件確認）

* 相手：「ご用件は？」
* **AI：超要約（10秒）→部署確認**

  * JP（10秒ピッチ）：「ありがとうございます。{{my\_company\_name}} では、**{{my\_service\_name}}** により、既存の名簿やウェブ反応に対して**AIが一次架電と仕分け**を行い、**見込み度の高いお客さまだけ**を営業におつなぎする仕組みをご提供しています。御社の{{callee\_department}}ご担当者さまに、概要だけご説明させていただけますか？」
  * EN (10-sec pitch): “Thank you. At {{my\_company\_name}}, **{{my\_service\_name}}** uses AI to handle **first calls and lead triage**, then routes **high-intent prospects** to your sales team. Could I briefly share the overview with someone in {{callee\_department}}?”

> 返答に応じて：
> ・取次OK → P1-Aへ
> ・**さらに詳しく**求められたら → P2-Bへ（30秒詳細）
> ・拒否／方針提示 → P3へ

---

## P2. 詳細説明が必要な場合（短く）

### P2-A 社名確認

* 相手：「社名は？」
* AI：

  * JP：「{{my\_company\_name}} でございます。担当は {{my\_representative\_name}} です。」
  * EN: “It’s {{my\_company\_name}}. My name is {{my\_representative\_name}}.”

### P2-B 30秒詳細（求められた場合のみ）

* JP：「詳しくは、（1）**AIが自動で一次架電→要件把握**、（2）**見込み度スコアで仕分け**、（3）**高確度のみ人の営業に引き継ぎ**、という流れです。**架電の無駄を削減**し、**商談化率の向上**に寄与します。ご担当者さまに5分ほどで概要をご説明できますが、おつなぎ可能でしょうか。」
* EN: “In short: (1) **AI performs first calls and captures intent**, (2) **scores and triages leads**, (3) **routes only high-potential prospects to human reps**. This cuts wasted calls and **improves conversion to meetings**. May I speak with the right person for a 5-minute overview?”

---

## P3. 取次不能・方針提示への対応

### P3-A 不在（外出・会議・他電話）

* AI：

  * JP：「承知しました。では、また改めてお電話いたします。ありがとうございます。」
  * EN: “Understood. I’ll try again another time. Thank you.”

### P3-B 新規電話は受け付けない

* AI：

  * JP：「承知いたしました。突然のご連絡、失礼いたしました。ありがとうございます。」
  * EN: “Understood. My apologies for the unsolicited call. Thank you for your time.”

### P3-C Webフォーム／メール指定

* AI：

  * JP：「承知しました。\*\*御社の問い合わせフォーム（またはメール）\*\*からご連絡いたします。ありがとうございます。」
  * EN: “Understood. I’ll reach out via your **contact form (or email)**. Thank you.”

---

## P4. 終話

* AI：

  * JP：「本日はありがとうございました。失礼いたします。」
  * EN: “Thank you for your time. Goodbye.”
* 相手の終話後 **0.7–1.2秒**で切断

---

# ミニ状態機械（実装の目安）

* **S0**：初回待機（無音2.0秒でAI開始）
* **S1**：開示（P0→P1）
* **S2**：用件確認対応（P1-C→10秒ピッチ→必要時30秒詳細）
* **S3**：取次／不在／方針の分岐（P1-A / P3-A/B/C）
* **S4**：終話（P4）

**ASRインテント最小セット**

* 〈取次OK〉〈不在〉〈新規拒否〉〈Web/メール誘導〉〈用件確認〉〈社名確認〉〈英語担当確認〉

---

## 使い方のコツ

* **最初の説明は10秒以内**、求められた時だけ30秒詳細へ。
* 「英語担当いますか？」には\*\*“日本語でもOK／概要だけでも”\*\*で詰まりを避ける。
* 「ご用件は？」に対しては\*\*価値→仕組み→お願い（部署確認 or 取次）\*\*の順で一文化。

この構成なら、「英語担当は？→ご用件は？」の揺れにも、**短く・礼儀正しく・止まらず**に対応できます。
