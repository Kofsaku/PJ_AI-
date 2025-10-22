"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, RotateCcw } from "lucide-react";
import { Sidebar } from "@/components/sidebar";

interface SalesPitchSettings {
  // 基本設定
  companyName: string;
  serviceName: string;
  representativeName: string;
  targetDepartment: string;
  serviceDescription: string;
  targetPerson: string;

  // AI設定
  voice: 'alloy' | 'cedar' | 'coral';
  speechRate: 'slow' | 'normal' | 'fast';
}

export default function SalesPitchSettingsPage() {
  const [settings, setSettings] = useState<SalesPitchSettings>({
    // 基本設定
    companyName: "",
    serviceName: "",
    representativeName: "",
    targetDepartment: "",
    serviceDescription: "",
    targetPerson: "",

    // AI設定
    voice: 'alloy',
    speechRate: 'normal'
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

        // voiceの値を検証（3つのvoiceのいずれか）
        const validVoices: Array<'alloy' | 'cedar' | 'coral'> = ['alloy', 'cedar', 'coral'];
        const voiceValue = agentData.voice || 'alloy';
        const validatedVoice = validVoices.includes(voiceValue) ? voiceValue : 'alloy';

        setSettings({
          // 基本設定
          companyName: agentData.conversationSettings?.companyName || "",
          serviceName: agentData.conversationSettings?.serviceName || "",
          representativeName: agentData.conversationSettings?.representativeName || "",
          targetDepartment: agentData.conversationSettings?.targetDepartment || "",
          serviceDescription: agentData.conversationSettings?.serviceDescription || "",
          targetPerson: agentData.conversationSettings?.targetPerson || "",

          // AI設定
          voice: validatedVoice,
          speechRate: agentData.conversationSettings?.speechRate || 'normal'
        });
      } else {
        console.log('Agent settings not found, using defaults');
        setSettings({
          // 基本設定
          companyName: "AIコールシステム株式会社",
          serviceName: "AIアシスタントサービス",
          representativeName: "佐藤",
          targetDepartment: "営業部",
          serviceDescription: "新規テレアポや掘り起こしなどの営業電話を人間に代わって生成AIが電話をかけるというサービスを提供している",
          targetPerson: "営業の担当者さま",

          // AI設定
          voice: 'alloy',
          speechRate: 'normal'
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
          voice: settings.voice,
          conversationSettings: {
            companyName: settings.companyName,
            serviceName: settings.serviceName,
            representativeName: settings.representativeName,
            targetDepartment: settings.targetDepartment,
            serviceDescription: settings.serviceDescription,
            targetPerson: settings.targetPerson,
            conversationStyle: 'formal', // 固定
            speechRate: settings.speechRate
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
      serviceDescription: "新規テレアポや掘り起こしなどの営業電話を人間に代わって生成AIが電話をかけるというサービスを提供している",
      targetPerson: "営業の担当者さま",

      // AI設定
      voice: 'alloy',
      speechRate: 'normal'
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
          <Card className="shadow-lg">
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

          {/* AI設定セクション */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>AI設定</CardTitle>
              <CardDescription>
                AIの声や話し方を設定できます（会話トーンは「フォーマル」に固定）
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* AIボイス */}
                <div className="space-y-3">
                  <Label>AIボイス</Label>
                  <RadioGroup
                    value={settings.voice}
                    onValueChange={(value: 'alloy' | 'cedar' | 'coral') =>
                      setSettings(prev => ({ ...prev, voice: value }))
                    }
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="alloy" id="voice-alloy" />
                      <Label htmlFor="voice-alloy" className="font-normal cursor-pointer">中性的で柔らかい</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="cedar" id="voice-cedar" />
                      <Label htmlFor="voice-cedar" className="font-normal cursor-pointer">ハキハキと明瞭</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="coral" id="voice-coral" />
                      <Label htmlFor="voice-coral" className="font-normal cursor-pointer">温かく友好的</Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* 話す速度 */}
                <div className="space-y-3">
                  <Label>話す速度</Label>
                  <RadioGroup
                    value={settings.speechRate}
                    onValueChange={(value: 'slow' | 'normal' | 'fast') =>
                      setSettings(prev => ({ ...prev, speechRate: value }))
                    }
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="slow" id="speed-slow" />
                      <Label htmlFor="speed-slow" className="font-normal cursor-pointer">ゆっくり</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="normal" id="speed-normal" />
                      <Label htmlFor="speed-normal" className="font-normal cursor-pointer">通常</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="fast" id="speed-fast" />
                      <Label htmlFor="speed-fast" className="font-normal cursor-pointer">早く</Label>
                    </div>
                  </RadioGroup>
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