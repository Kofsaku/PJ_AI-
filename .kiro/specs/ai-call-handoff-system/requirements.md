# Requirements Document

## Introduction

AIコールシステムは、営業担当者が効率的に見込み顧客にアプローチできるよう、AIが初期の受付対応を自動化し、適切なタイミングで人間の営業担当者に通話を引き継ぐシステムです。従来の電話営業では受付スタッフとの対話に時間を費やし、担当者と直接話せないケースが多いという課題を解決します。

現在の実装では基本的な顧客管理、CSV取り込み、Twilioを使った通話機能、AI音声応答が実装されていますが、リアルタイムでの人間への引き継ぎ機能が不完全な状態です。

## Requirements

### Requirement 1

**User Story:** As a 営業担当者, I want リアルタイムで通話状況を監視し任意のタイミングでAIから人間に切り替えられる, so that 適切なタイミングで見込み顧客と直接会話できる

#### Acceptance Criteria

1. WHEN 営業担当者がダッシュボードにアクセス THEN システムは現在進行中の通話一覧を表示 SHALL する
2. WHEN AIが顧客と通話中 THEN 営業担当者は通話内容をリアルタイムで確認 SHALL できる
3. WHEN 営業担当者が「取り次ぎ」ボタンをクリック THEN システムはAIから人間に通話を即座に転送 SHALL する
4. WHEN 通話が人間に転送される THEN 顧客には「担当者におつなぎします」というメッセージが再生 SHALL される
5. WHEN 人間への転送が完了 THEN 営業担当者と顧客が直接会話 SHALL できる

### Requirement 2

**User Story:** As a 営業担当者, I want 通話履歴と結果を自動的に記録・管理したい, so that 効果的なフォローアップと営業戦略の改善ができる

#### Acceptance Criteria

1. WHEN AI通話が開始される THEN システムは通話開始時刻、顧客情報、通話状況を記録 SHALL する
2. WHEN AI通話中に会話が発生 THEN システムは音声認識結果と応答内容を記録 SHALL する
3. WHEN 人間に引き継がれる THEN システムは引き継ぎ時刻と引き継ぎ理由を記録 SHALL する
4. WHEN 通話が終了 THEN システムは通話時間、結果、次回アクション予定を記録 SHALL する
5. WHEN 営業担当者がダッシュボードにアクセス THEN 全ての通話履歴を検索・フィルタリング SHALL できる

### Requirement 3

**User Story:** As a システム管理者, I want 複数の営業担当者が同時に異なる通話を処理できる, so that チーム全体の営業効率を最大化できる

#### Acceptance Criteria

1. WHEN 複数のAI通話が同時進行 THEN システムは各通話を独立して管理 SHALL する
2. WHEN 営業担当者がログイン THEN システムは担当者専用のダッシュボードを表示 SHALL する
3. WHEN 担当者が通話中 THEN システムは他の担当者に新しい引き継ぎ要求を振り分け SHALL する
4. WHEN 担当者が利用可能状態 THEN システムは優先度に基づいて引き継ぎ要求を割り当て SHALL する
5. WHEN システム負荷が高い THEN システムは適切なエラーハンドリングと待機メッセージを提供 SHALL する

### Requirement 4

**User Story:** As a 営業担当者, I want AIの会話品質と引き継ぎタイミングを改善したい, so that より多くの見込み顧客と効果的な会話ができる

#### Acceptance Criteria

1. WHEN AIが顧客と会話 THEN システムは会話の流れと顧客の反応を分析 SHALL する
2. WHEN 顧客が担当者との会話を希望 THEN AIは適切な引き継ぎフレーズを使用 SHALL する
3. WHEN 顧客が拒否的な反応を示す THEN AIは丁寧に通話を終了 SHALL する
4. WHEN 顧客が不在や忙しい状態 THEN AIは適切な再連絡の提案を行う SHALL する
5. WHEN 会話が予期しない方向に進む THEN システムは自動的に人間への引き継ぎを提案 SHALL する

### Requirement 5

**User Story:** As a 営業担当者, I want 顧客データベースを効率的に管理し通話結果を反映したい, so that 継続的な営業活動を効果的に行える

#### Acceptance Criteria

1. WHEN CSVファイルをアップロード THEN システムは顧客データを検証し重複を防止 SHALL する
2. WHEN 通話結果が記録される THEN システムは顧客ステータスを自動更新 SHALL する
3. WHEN 営業担当者が顧客情報を編集 THEN システムは変更履歴を保持 SHALL する
4. WHEN フォローアップが必要 THEN システムは適切なリマインダーを設定 SHALL する
5. WHEN 営業担当者がレポートを要求 THEN システムは通話成功率と顧客反応の統計を提供 SHALL する

### Requirement 6

**User Story:** As a 営業担当者, I want 自分の電話番号と会話設定を管理したい, so that AIから適切に通話を引き継ぎ、効果的な営業活動ができる

#### Acceptance Criteria

1. WHEN 営業担当者が設定画面にアクセス THEN システムは電話番号設定フォームを表示 SHALL する
2. WHEN 営業担当者が電話番号を設定 THEN システムは番号を検証し保存 SHALL する
3. WHEN 営業担当者が会話設定を更新 THEN システムは会社名、サービス名、担当者名、部署名を保存 SHALL する
4. WHEN 営業担当者がカスタム応答テンプレートを設定 THEN システムはテンプレートを保存し次回通話で使用 SHALL する
5. WHEN 営業担当者が可用性ステータスを変更 THEN システムは即座にステータスを更新 SHALL する

### Requirement 7

**User Story:** As a システム, I want 構造化された会話フローでAI応答を管理したい, so that 自然で効果的な営業電話を実現できる

#### Acceptance Criteria

1. WHEN AI通話が開始される THEN システムは設定された会話変数を使用して初期挨拶を生成 SHALL する
2. WHEN 顧客が無言または不明確な応答をする THEN AIは適切な再確認メッセージを送信 SHALL する
3. WHEN 顧客が社名確認を求める THEN AIは会社名と担当者名を再度伝える SHALL する
4. WHEN 顧客が不在を伝える THEN AIは丁寧に通話を終了し再連絡を約束 SHALL する
5. WHEN 顧客が新規営業を断る THEN AIは謝罪し丁寧に通話を終了 SHALL する
6. WHEN 顧客がWebサイト経由での連絡を希望 THEN AIは承諾し適切に通話を終了 SHALL する
7. WHEN 担当者に繋がる可能性が高い THEN システムは自動的に人間への引き継ぎを提案 SHALL する