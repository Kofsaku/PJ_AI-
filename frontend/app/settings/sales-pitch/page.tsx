"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, RotateCcw, Play, Plus, X, AlertCircle } from "lucide-react";
import { Sidebar } from "@/components/sidebar";

interface SalesPitchSettings {
  // 基本設定
  companyName: string;
  serviceName: string;
  representativeName: string;
  targetDepartment: string;

  // その他設定
  serviceDescription: string;
  targetPerson: string;

  // セールスピッチ設定
  companyDescription: string;
  callToAction: string;
  keyBenefits: string[];
}

export default function SalesPitchSettingsPage() {
  const [settings, setSettings] = useState<SalesPitchSettings>({
    // 基本設定
    companyName: "",
    serviceName: "",
    representativeName: "",
    targetDepartment: "",

    // その他設定
    serviceDescription: "",
    targetPerson: "",

    // セールスピッチ設定
    companyDescription: "",
    callToAction: "",
    keyBenefits: []
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/users/sales-pitch', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await response.json();
      if (data && data.data) {
        const agentData = data.data;
        setSettings({
          // 基本設定
          companyName: agentData.conversationSettings?.companyName || "",
          serviceName: agentData.conversationSettings?.serviceName || "",
          representativeName: agentData.conversationSettings?.representativeName || "",
          targetDepartment: agentData.conversationSettings?.targetDepartment || "",

          // その他設定
          serviceDescription: agentData.conversationSettings?.serviceDescription || "",
          targetPerson: agentData.conversationSettings?.targetPerson || "",

          // セールスピッチ設定
          companyDescription: agentData.conversationSettings?.salesPitch?.companyDescription || "",
          callToAction: agentData.conversationSettings?.salesPitch?.callToAction || "",
          keyBenefits: agentData.conversationSettings?.salesPitch?.keyBenefits || []
        });
      } else {
        console.log('Agent settings not found, using defaults');
        setSettings({
          // 基本設定
          companyName: "AIコールシステム株式会社",
          serviceName: "AIアシスタントサービス",
          representativeName: "佐藤",
          targetDepartment: "営業部",

          // その他設定
          serviceDescription: "新規テレアポや掘り起こしなどの営業電話を人間に代わって生成AIが電話をかけるというサービスを提供している",
          targetPerson: "営業の担当者さま",

          // セールスピッチ設定
          companyDescription: "AIコールシステム株式会社では、生成AIを使った新規顧客獲得テレアポ支援により、AIが一次架電と仕分けを行い、見込み度の高いお客さまだけを営業におつなぎする仕組みをご提供しています。",
          callToAction: "御社の営業部ご担当者さまに、概要だけご説明させていただけますか？",
          keyBenefits: []
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast({
        title: "エラー",
        description: "設定の読み込み中にエラーが発生しました。",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      console.log('[Sales Pitch] Saving settings...', settings);
      
      const token = localStorage.getItem('token');
      const response = await fetch('/api/users/sales-pitch', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationSettings: {
            companyName: settings.companyName,
            serviceName: settings.serviceName,
            representativeName: settings.representativeName,
            targetDepartment: settings.targetDepartment,
            serviceDescription: settings.serviceDescription,
            targetPerson: settings.targetPerson,
            salesPitch: {
              companyDescription: settings.companyDescription,
              callToAction: settings.callToAction,
              keyBenefits: settings.keyBenefits
            }
          }
        })
      });
      
      const saveResult = await response.json();
      console.log('[Sales Pitch] Save result:', saveResult);
      
      toast({
        title: "保存完了",
        description: "トークスクリプト設定が保存されました。"
      });
      
      // 保存後に設定を再読み込み（一時的に無効化）
      // await loadSettings();
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "エラー",
        description: "設定の保存に失敗しました。",
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const resetToDefault = () => {
    setSettings({
      // 基本設定
      companyName: "AIコールシステム株式会社",
      serviceName: "AIアシスタントサービス",
      representativeName: "佐藤",
      targetDepartment: "営業部",

      // その他設定
      serviceDescription: "新規テレアポや掘り起こしなどの営業電話を人間に代わって生成AIが電話をかけるというサービスを提供している",
      targetPerson: "営業の担当者さま",

      // セールスピッチ設定
      companyDescription: "弊社では、AIアシスタントサービスを提供しております。AIが一次架電を行い、見込み度の高いお客様だけを営業におつなぎする仕組みです。",
      callToAction: "ぜひ御社の営業部ご担当者さまに概要をご案内できればと思いまして。",
      keyBenefits: []
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Sidebar />
        <main className="ml-64 p-6 flex items-center justify-center">
          <div className="flex items-center">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">設定を読み込み中...</span>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <main className="ml-64 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">トークスクリプト設定</h1>
            <p className="text-muted-foreground mt-2">
              AI通話で使用するトークスクリプトの変数をカスタマイズできます。
            </p>
          </div>

          {/* 基本設定セクション */}
          <Card className="border-2 border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                基本設定（必須）
                <Badge variant="destructive">必須</Badge>
              </CardTitle>
              <CardDescription>
                AI会話ガイドラインの生成に必要な6つの必須項目です。
                これらの情報は受付突破から担当者対応まで、全ての会話シーンで使用されます。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* 基本情報 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="companyName" className="flex items-center gap-2">
                      会社名
                      <Badge variant="outline" className="text-xs">必須</Badge>
                    </Label>
                    <Input
                      id="companyName"
                      placeholder="会社名を入力してください"
                      value={settings.companyName}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        companyName: e.target.value
                      }))}
                      required
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      💡 例：「AIコールシステム株式会社」<br />
                      → AIが名乗る際に使用されます
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="representativeName" className="flex items-center gap-2">
                      担当者名
                      <Badge variant="outline" className="text-xs">必須</Badge>
                    </Label>
                    <Input
                      id="representativeName"
                      placeholder="担当者名を入力してください"
                      value={settings.representativeName}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        representativeName: e.target.value
                      }))}
                      required
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      💡 例：「佐藤」「田中」<br />
                      → AIがあなたとして名乗ります
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="targetDepartment" className="flex items-center gap-2">
                      対象部門
                      <Badge variant="outline" className="text-xs">必須</Badge>
                    </Label>
                    <Input
                      id="targetDepartment"
                      placeholder="対象部門を入力してください"
                      value={settings.targetDepartment}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        targetDepartment: e.target.value
                      }))}
                      required
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      💡 例：「営業部」「人事部」「総務部」<br />
                      → 「○○部のご担当者様」として呼び出します
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="targetPerson" className="flex items-center gap-2">
                      対象者
                      <Badge variant="outline" className="text-xs">必須</Badge>
                    </Label>
                    <Input
                      id="targetPerson"
                      placeholder="話したい相手の表現を入力してください"
                      value={settings.targetPerson}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        targetPerson: e.target.value
                      }))}
                      required
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      💡 例：「営業の担当者さま」「ご担当者さま」<br />
                      → 受付に「○○はいらっしゃいますか？」と尋ねます
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="serviceName" className="flex items-center gap-2">
                      サービス名
                      <Badge variant="outline" className="text-xs">必須</Badge>
                    </Label>
                    <Input
                      id="serviceName"
                      placeholder="サービス名を入力してください"
                      value={settings.serviceName}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        serviceName: e.target.value
                      }))}
                      required
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      💡 例：「AIアシスタントサービス」「自動音声コールシステム」<br />
                      → 「○○のご案内でお電話しました」と伝えます
                    </p>
                  </div>
                </div>

                {/* サービス説明 */}
                <div>
                  <Label htmlFor="serviceDescription" className="flex items-center gap-2">
                    サービス概要
                    <Badge variant="outline" className="text-xs">必須</Badge>
                  </Label>
                  <Textarea
                    id="serviceDescription"
                    placeholder="サービスの簡潔な説明を1〜2文で入力してください"
                    value={settings.serviceDescription}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      serviceDescription: e.target.value
                    }))}
                    className="min-h-[80px]"
                    required
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    💡 例：「新規テレアポや掘り起こしなどの営業電話を人間に代わって生成AIが電話をかけるというサービスを提供している」<br />
                    → 受付から「どんなサービスですか？」と聞かれた時に使用されます
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 詳細設定セクション（任意） */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                詳細設定（任意）
                <Badge variant="secondary">任意</Badge>
              </CardTitle>
              <CardDescription>
                より詳細な会社説明やキーメッセージを設定できます。
                設定しない場合は基本設定から自動的に会話ガイドラインが生成されます。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* 会社詳細説明 */}
                <div>
                  <Label htmlFor="companyDescription">会社詳細説明</Label>
                  <Textarea
                    id="companyDescription"
                    placeholder="会社とサービスの詳しい説明を入力してください（任意）"
                    value={settings.companyDescription}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      companyDescription: e.target.value
                    }))}
                    className="min-h-[100px]"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    💡 例：「弊社では、AIアシスタントサービスを提供しております。AIが一次架電を行い、見込み度の高いお客様だけを営業におつなぎする仕組みです。」<br />
                    → 担当者との会話で、より詳しい説明が必要な際に使用されます
                  </p>
                </div>

                {/* アクション呼びかけ */}
                <div>
                  <Label htmlFor="callToAction">アクション呼びかけ</Label>
                  <Input
                    id="callToAction"
                    placeholder="最終的な依頼内容を入力してください（任意）"
                    value={settings.callToAction}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      callToAction: e.target.value
                    }))}
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    💡 例：「ぜひ御社の営業部ご担当者さまに概要をご案内できればと思いまして。」<br />
                    → 転送を打診する際のクロージングで使用されます
                  </p>
                </div>

                {/* キーベネフィット */}
                <div>
                  <Label>キーベネフィット（複数設定可能）</Label>
                  <div className="space-y-2 mt-2">
                    {settings.keyBenefits && settings.keyBenefits.length > 0 ? (
                      settings.keyBenefits.map((benefit, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Input
                            value={benefit}
                            onChange={(e) => {
                              const newBenefits = [...settings.keyBenefits];
                              newBenefits[index] = e.target.value;
                              setSettings(prev => ({
                                ...prev,
                                keyBenefits: newBenefits
                              }));
                            }}
                            placeholder={`ベネフィット ${index + 1}`}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              const newBenefits = settings.keyBenefits.filter((_, i) => i !== index);
                              setSettings(prev => ({
                                ...prev,
                                keyBenefits: newBenefits
                              }));
                            }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">まだベネフィットが設定されていません</p>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSettings(prev => ({
                          ...prev,
                          keyBenefits: [...(prev.keyBenefits || []), '']
                        }));
                      }}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      ベネフィットを追加
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    💡 例：「営業コスト削減」「商談化率向上」「24時間対応可能」<br />
                    → サービスの主なメリットを簡潔に列挙します
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* AI会話ガイドラインプレビュー */}
          <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="h-5 w-5 text-green-600" />
                🤖 AI会話ガイドラインプレビュー
              </CardTitle>
              <CardDescription>
                入力した設定がどのようにAI会話ガイドラインに反映されるかを確認できます。<br />
                <Badge variant="secondary" className="mt-2">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  重要: これらは「例」であり、AIは状況に応じて自然な言い回しで対応します
                </Badge>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Step 1: 受付への初回挨拶 */}
                <div className="border-l-4 border-blue-500 pl-4">
                  <h4 className="font-semibold text-sm text-gray-800 mb-2">📞 Step 1: 受付への初回挨拶</h4>
                  <div className="bg-white border border-blue-200 rounded-lg p-4 mb-2">
                    <p className="text-xs text-gray-600 mb-2 font-semibold">やること:</p>
                    <ol className="text-sm text-gray-700 list-decimal list-inside space-y-1 mb-3">
                      <li>丁寧に名乗る（会社名と自分の名前）</li>
                      <li>サービス名を簡潔に伝える</li>
                      <li>担当部署の担当者を呼び出す</li>
                    </ol>
                    <p className="text-xs text-gray-600 mb-2 font-semibold">例:</p>
                    <div className="bg-blue-50 border border-blue-300 rounded p-3">
                      <p className="text-sm text-gray-800 leading-relaxed">
                        「お世話になります。<span className="font-bold text-blue-700">{settings.companyName || '○○株式会社'}</span>の<span className="font-bold text-blue-700">{settings.representativeName || '○○'}</span>です。<span className="font-bold text-blue-700">{settings.serviceName || '○○サービス'}</span>のご案内でお電話しました。<span className="font-bold text-blue-700">{settings.targetDepartment || '○○部'}</span>のご担当者様はいらっしゃいますでしょうか？」
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 italic">トーン: 落ち着いて、丁寧に。押し売り感は絶対に出さない。</p>
                </div>

                {/* Step 2: 用件を聞かれた時 */}
                <div className="border-l-4 border-purple-500 pl-4">
                  <h4 className="font-semibold text-sm text-gray-800 mb-2">🔍 Step 2: 「どういったご用件ですか？」と聞かれた時</h4>
                  <div className="bg-white border border-purple-200 rounded-lg p-4 mb-2">
                    <p className="text-xs text-gray-600 mb-2 font-semibold">やること:</p>
                    <ol className="text-sm text-gray-700 list-decimal list-inside space-y-1 mb-3">
                      <li>「新規サービスのご案内」と伝える</li>
                      <li>サービスの要点を1文で説明</li>
                      <li>「詳細は担当者様に直接ご説明したい」と伝える</li>
                      <li>再度、担当者への取次を依頼</li>
                    </ol>
                    {settings.serviceDescription && (
                      <div className="bg-purple-50 border border-purple-300 rounded p-3">
                        <p className="text-sm text-gray-800 leading-relaxed">
                          「新規サービスのご案内です。<span className="font-bold text-purple-700">{settings.serviceDescription}</span> 詳細はご担当者様に直接ご説明したく存じます。」
                        </p>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 italic">ポイント: 受付を説得しようとしない、詳細な機能説明はしない</p>
                </div>

                {/* Step 3: 担当者に代わった時 */}
                <div className="border-l-4 border-green-500 pl-4">
                  <h4 className="font-semibold text-sm text-gray-800 mb-2">🎙️ Step 3: 担当者に電話が代わった時</h4>
                  <div className="bg-white border border-green-200 rounded-lg p-4 mb-2">
                    <p className="text-xs text-gray-600 mb-2 font-semibold">やること:</p>
                    <ol className="text-sm text-gray-700 list-decimal list-inside space-y-1 mb-3">
                      <li>電話を代わってくれたことに感謝</li>
                      <li>改めて名乗る</li>
                      <li>サービスの概要を2〜3文で簡潔に説明</li>
                      <li>「詳細は弊社の営業担当からご説明したい」と伝える</li>
                      <li>「2〜3分お時間よろしいでしょうか？」と転送を打診</li>
                    </ol>
                    {settings.companyDescription && (
                      <div className="bg-green-50 border border-green-300 rounded p-3 mb-2">
                        <p className="text-sm text-gray-800 leading-relaxed">
                          <span className="font-bold text-green-700">{settings.companyDescription}</span>
                        </p>
                      </div>
                    )}
                    {settings.callToAction && (
                      <div className="bg-green-50 border border-green-300 rounded p-3">
                        <p className="text-sm text-gray-800 leading-relaxed">
                          「<span className="font-bold text-green-700">{settings.callToAction}</span> 2〜3分お時間よろしいでしょうか？」
                        </p>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 italic">ポイント: サービスの「何が」「どう役立つか」の要点のみ、すぐに転送打診に移る</p>
                </div>

                {/* 重要な注意事項 */}
                <div className="bg-amber-50 border-2 border-amber-400 rounded-lg p-4">
                  <h4 className="font-semibold text-sm text-amber-900 mb-2 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    重要な注意事項
                  </h4>
                  <ul className="text-sm text-amber-900 space-y-1 list-disc list-inside">
                    <li>上記は「例」であり、AIが一字一句守る必要はありません</li>
                    <li>状況に応じて自然な言い回しで対応します</li>
                    <li>ただし、会社情報やサービス名は正確に伝えます</li>
                    <li>押し売り感は絶対に出さず、丁寧な対応を心がけます</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button
              onClick={saveSettings}
              disabled={saving}
              size="lg"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  設定を保存
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={resetToDefault}
              size="lg"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              デフォルトに戻す
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}