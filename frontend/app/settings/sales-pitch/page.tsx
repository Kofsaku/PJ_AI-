"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, RotateCcw, Play } from "lucide-react";
import { Sidebar } from "@/components/sidebar";
import { authenticatedApiRequest } from "@/lib/apiHelper";

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
  const [newBenefit, setNewBenefit] = useState("");
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
          companyName: settings.companyName,
          serviceName: settings.serviceName,
          representativeName: settings.representativeName,
          targetDepartment: settings.targetDepartment,
          serviceDescription: settings.serviceDescription,
          targetPerson: settings.targetPerson,
          companyDescription: settings.companyDescription,
          callToAction: settings.callToAction,
          keyBenefits: settings.keyBenefits
        })
      });
      
      const saveResult = await response.json();
      console.log('[Sales Pitch] Save result:', saveResult);
      
      toast({
        title: "保存完了",
        description: "トークスクリプト設定が保存されました。"
      });
      
      // 保存後に設定を再読み込み
      await loadSettings();
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

  // 動的に生成される自己紹介文
  const dynamicSelfIntroduction = `わたくし${settings.companyName || 'ＡＩコールシステム'}の${settings.representativeName || '安達'}と申します`;

  // ハイライト付きの自己紹介文
  const dynamicSelfIntroductionHighlighted = `わたくし<span class="font-semibold text-blue-600">${settings.companyName || '（未設定）'}</span>の<span class="font-semibold text-blue-600">${settings.representativeName || '（未設定）'}</span>と申します`;

  // 変数置換を行う関数（変数部分をハイライト）
  const replaceVariables = (template: string): string => {
    return template
      .replace(/\{\{companyName\}\}/g, `<span class="font-semibold text-blue-600">${settings.companyName || "（未設定）"}</span>`)
      .replace(/\{\{serviceName\}\}/g, `<span class="font-semibold text-blue-600">${settings.serviceName || "（未設定）"}</span>`)
      .replace(/\{\{representativeName\}\}/g, `<span class="font-semibold text-blue-600">${settings.representativeName || "（未設定）"}</span>`)
      .replace(/\{\{targetDepartment\}\}/g, `<span class="font-semibold text-blue-600">${settings.targetDepartment || "（未設定）"}</span>`)
      .replace(/\{\{selfIntroduction\}\}/g, `<span class="font-semibold text-blue-600">${dynamicSelfIntroduction}</span>`)
      .replace(/\{\{serviceDescription\}\}/g, `<span class="font-semibold text-blue-600">${settings.serviceDescription || "（未設定）"}</span>`)
      .replace(/\{\{targetPerson\}\}/g, `<span class="font-semibold text-blue-600">${settings.targetPerson || "（未設定）"}</span>`);
  };

  // トークスクリプトテンプレート
  const talkTemplates = {
    initial: "お世話になります。{{selfIntroduction}}。弊社は{{serviceDescription}}会社でございます。{{serviceName}}について、是非御社の{{targetDepartment}}にご案内できればと思いお電話をさせていただきました。本日、{{targetPerson}}はいらっしゃいますでしょうか？",
    clarification: "失礼しました。{{companyName}}の{{representativeName}}です。{{serviceName}}についてご担当者さまにご案内の可否を伺っております。",
    salesPitch: `ありがとうございます。${settings.companyDescription || "弊社では、革新的なサービスを提供しております。"}

${settings.callToAction || "ぜひ御社の営業部ご担当者さまに概要をご案内できればと思いまして。"}`,
    transferExplanation: "お忙しいところすみません。{{selfIntroduction}}。弊社は{{serviceDescription}}会社でございます。\n\nこれより直接担当者から詳細をご説明させて頂いてもよろしいでしょうか？\nお構いなければAIコールシステムから弊社の担当者に取り次ぎのうえご説明申し上げます。"
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
          <Card>
            <CardHeader>
              <CardTitle>基本設定</CardTitle>
              <CardDescription>
                会社の基本情報とエージェントの識別情報を設定します。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* 基本情報 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="companyName">会社名</Label>
                    <Input
                      id="companyName"
                      placeholder="会社名を入力してください"
                      value={settings.companyName}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        companyName: e.target.value
                      }))}
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      例：「AIコールシステム株式会社」
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="representativeName">担当者名</Label>
                    <Input
                      id="representativeName"
                      placeholder="担当者名を入力してください"
                      value={settings.representativeName}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        representativeName: e.target.value
                      }))}
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      例：「佐藤」「田中」
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="targetDepartment">対象部門</Label>
                    <Input
                      id="targetDepartment"
                      placeholder="対象部門を入力してください"
                      value={settings.targetDepartment}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        targetDepartment: e.target.value
                      }))}
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      例：「営業部」「人事部」「総務部」
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="targetPerson">対象者</Label>
                    <Input
                      id="targetPerson"
                      placeholder="話したい相手の表現を入力してください"
                      value={settings.targetPerson}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        targetPerson: e.target.value
                      }))}
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      例：「営業の担当者さま」「ご担当者さま」
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="serviceName">サービス名</Label>
                    <Input
                      id="serviceName"
                      placeholder="サービス名を入力してください"
                      value={settings.serviceName}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        serviceName: e.target.value
                      }))}
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      例：「AIアシスタントサービス」「自動音声コールシステム」
                    </p>
                  </div>
                </div>

                {/* サービス説明 */}
                <div>
                  <Label htmlFor="serviceDescription">サービス説明文</Label>
                  <Textarea
                    id="serviceDescription"
                    placeholder="サービスの簡潔な説明を入力してください"
                    value={settings.serviceDescription}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      serviceDescription: e.target.value
                    }))}
                    className="min-h-[80px]"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    例：「新規テレアポや掘り起こしなどの営業電話を人間に代わって生成AIが電話をかけるというサービスを提供している」
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 基本トークプレビューセクション */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="h-5 w-5" />
                基本トークプレビュー
              </CardTitle>
              <CardDescription>
                基本設定で入力した内容がどのようにトークに反映されるかを確認できます。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* 自動生成される自己紹介 */}
                <div>
                  <h4 className="font-semibold text-sm text-gray-700 mb-2">🤖 自動生成される自己紹介</h4>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p
                      className="text-sm text-gray-800"
                      dangerouslySetInnerHTML={{ __html: dynamicSelfIntroductionHighlighted }}
                    />
                    <p className="text-xs text-blue-600 mt-1">
                      ※「会社名」と「担当者名」から自動生成
                    </p>
                  </div>
                </div>

                {/* 初回コンタクト */}
                <div>
                  <h4 className="font-semibold text-sm text-gray-700 mb-2">📞 初回コンタクト（電話開始時）</h4>
                  <div className="bg-sky-50 border border-sky-200 rounded-lg p-4">
                    <p
                      className="text-sm leading-relaxed whitespace-pre-wrap"
                      dangerouslySetInnerHTML={{ __html: replaceVariables(talkTemplates.initial) }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>


          {/* トークプレビューセクション */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="h-5 w-5" />
                トークプレビュー
              </CardTitle>
              <CardDescription>
                設定した変数でのトーク内容をリアルタイムでプレビューできます。
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* 聞き返し応答 */}
                <div>
                  <h4 className="font-semibold text-sm text-gray-700 mb-2">❓ 聞き返し・確認応答</h4>
                  <div className="bg-sky-50 border border-sky-200 rounded-lg p-4">
                    <p
                      className="text-sm leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: replaceVariables(talkTemplates.clarification) }}
                    />
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    「用件を教えてください」「会社名を教えてください」「もう一度お願いします」等に使用
                  </p>
                </div>

                {/* 肯定的応答 */}
                <div>
                  <h4 className="font-semibold text-sm text-gray-700 mb-2">✅ 肯定的応答</h4>
                  <div className="bg-sky-50 border border-sky-200 rounded-lg p-4">
                    <p className="text-sm leading-relaxed">
                      ありがとうございます。よろしくお願いいたします。
                    </p>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    「はい」「お願いします」「いいですよ」等の同意・肯定に使用
                  </p>
                </div>

                {/* 不在応答 */}
                <div>
                  <h4 className="font-semibold text-sm text-gray-700 mb-2">❌ 不在応答</h4>
                  <div className="bg-sky-50 border border-sky-200 rounded-lg p-4">
                    <p className="text-sm leading-relaxed">
                      承知しました。では、また改めてお電話いたします。ありがとうございました。
                    </p>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    「不在です」「いません」「席を外しています」等に使用
                  </p>
                </div>

                {/* 断り応答 */}
                <div>
                  <h4 className="font-semibold text-sm text-gray-700 mb-2">🚫 お断り応答</h4>
                  <div className="bg-sky-50 border border-sky-200 rounded-lg p-4">
                    <p className="text-sm leading-relaxed">
                      承知いたしました。本日は突然のご連絡、失礼いたしました。よろしくお願いいたします。
                    </p>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    「必要ない」「お断りします」「営業お断り」等に使用
                  </p>
                </div>

                {/* 担当者取次応答 */}
                <div>
                  <h4 className="font-semibold text-sm text-gray-700 mb-2">👤 担当者取次応答</h4>
                  <div className="bg-sky-50 border border-sky-200 rounded-lg p-4">
                    <p className="text-sm leading-relaxed">
                      ありがとうございます。お待ちしております。
                    </p>
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    「担当者に代わります」「少々お待ちください」等に使用
                  </p>
                </div>

                {/* 転送説明 */}
                <div>
                  <h4 className="font-semibold text-sm text-gray-700 mb-2">🔄 転送前説明</h4>
                  <div className="bg-sky-50 border border-sky-200 rounded-lg p-4">
                    <p
                      className="text-sm leading-relaxed whitespace-pre-wrap"
                      dangerouslySetInnerHTML={{ __html: replaceVariables(talkTemplates.transferExplanation) }}
                    />
                  </div>
                  <p className="text-xs text-gray-600 mt-2">
                    担当者が電話に出た際の詳細説明
                  </p>
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