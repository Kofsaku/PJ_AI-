"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, RotateCcw } from "lucide-react";

interface SalesPitchSettings {
  companyDescription: string;
  serviceDescription: string;
  callToAction: string;
  keyBenefits: string[];
}

export default function SalesPitchSettingsPage() {
  const [settings, setSettings] = useState<SalesPitchSettings>({
    companyDescription: "",
    serviceDescription: "",
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
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(data.data.salesPitch);
      } else {
        // Log the actual error for debugging
        const errorData = await response.json();
        console.error('API Error:', response.status, errorData);
        
        // If agent settings don't exist (404), use default values
        if (response.status === 404) {
          console.log('Agent settings not found, using defaults');
          setSettings({
            companyDescription: "AIコールシステム株式会社では、生成AIを使った新規顧客獲得テレアポ支援により、AIが一次架電と仕分けを行い、見込み度の高いお客さまだけを営業におつなぎする仕組みをご提供しています。",
            serviceDescription: "概要だけご説明させていただけますか？",
            callToAction: "御社の営業部ご担当者さまに、概要だけご説明させていただけますか？",
            keyBenefits: []
          });
          
          toast({
            title: "初期設定",
            description: "エージェント設定が見つからないため、デフォルト値を使用します。まず基本設定を完了してください。",
            variant: "default"
          });
        } else {
          throw new Error(`Failed to load settings: ${response.status} ${errorData.message || ''}`);
        }
      }
    } catch (error) {
      console.error('Error loading sales pitch settings:', error);
      
      // Use default settings as fallback
      setSettings({
        companyDescription: "AIコールシステム株式会社では、生成AIを使った新規顧客獲得テレアポ支援により、AIが一次架電と仕分けを行い、見込み度の高いお客さまだけを営業におつなぎする仕組みをご提供しています。",
        serviceDescription: "概要だけご説明させていただけますか？",
        callToAction: "御社の営業部ご担当者さまに、概要だけご説明させていただけますか？",
        keyBenefits: []
      });
      
      toast({
        title: "警告",
        description: "設定の読み込み中にエラーが発生しました。デフォルト値を使用します。",
        variant: "default"
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch('/api/users/sales-pitch', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(settings)
      });

      if (response.ok) {
        toast({
          title: "保存完了",
          description: "セールスピッチ設定が保存されました。",
        });
      } else {
        const errorData = await response.json();
        console.error('Save API Error:', response.status, errorData);
        
        if (response.status === 404) {
          toast({
            title: "エラー",
            description: "エージェント設定が見つかりません。まず基本設定を完了してください。",
            variant: "destructive"
          });
        } else {
          throw new Error(`Failed to save settings: ${response.status} ${errorData.message || ''}`);
        }
      }
    } catch (error) {
      console.error('Error saving sales pitch settings:', error);
      toast({
        title: "エラー",
        description: `セールスピッチ設定の保存に失敗しました: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setSaving(false);
    }
  };

  const resetToDefault = () => {
    setSettings({
      companyDescription: "弊社では、AIアシスタントサービスを提供しております。AIが一次架電を行い、見込み度の高いお客様だけを営業におつなぎする仕組みです。",
      serviceDescription: "（1）AIが自動で一次架電→要件把握、（2）見込み度スコアで仕分け、（3）高確度のみ人の営業に引き継ぎ、という流れです。架電の無駄を削減し、商談化率の向上に寄与します。",
      callToAction: "ぜひ御社の営業部ご担当者さまに概要をご案内できればと思いまして。",
      keyBenefits: []
    });
  };

  const addBenefit = () => {
    if (newBenefit.trim() && !settings.keyBenefits.includes(newBenefit.trim())) {
      setSettings(prev => ({
        ...prev,
        keyBenefits: [...prev.keyBenefits, newBenefit.trim()]
      }));
      setNewBenefit("");
    }
  };

  const removeBenefit = (index: number) => {
    setSettings(prev => ({
      ...prev,
      keyBenefits: prev.keyBenefits.filter((_, i) => i !== index)
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">設定を読み込み中...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">セールスピッチ設定</h1>
          <p className="text-muted-foreground mt-2">
            AI通話で使用するセールスピッチをカスタマイズできます。
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>会社・サービス紹介文</CardTitle>
            <CardDescription>
              「用件を教えてください」と聞かれた際に使用される会社とサービスの説明文です。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="companyDescription">会社紹介文</Label>
                <Textarea
                  id="companyDescription"
                  placeholder="会社名とサービス概要を記入してください"
                  value={settings.companyDescription}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    companyDescription: e.target.value
                  }))}
                  className="min-h-[120px]"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  例：「AIコールシステム株式会社では、生成AIを使った新規顧客獲得テレアポ支援により...」
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>コールトゥアクション</CardTitle>
            <CardDescription>
              会社紹介の後に続ける、具体的なアクション要請文です。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="callToAction">アクション要請文</Label>
                <Textarea
                  id="callToAction"
                  placeholder="担当者への取次や説明の要請文を記入してください"
                  value={settings.callToAction}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    callToAction: e.target.value
                  }))}
                  className="min-h-[80px]"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  例：「御社の営業部ご担当者さまに、概要だけご説明させていただけますか？」
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>簡潔な説明文</CardTitle>
            <CardDescription>
              より詳しい説明を求められた際に使用される短い説明文です。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="serviceDescription">サービス概要</Label>
                <Textarea
                  id="serviceDescription"
                  placeholder="サービスの要点を簡潔に記入してください"
                  value={settings.serviceDescription}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    serviceDescription: e.target.value
                  }))}
                  className="min-h-[80px]"
                />
                <p className="text-sm text-muted-foreground mt-1">
                  例：「概要だけご説明させていただけますか？」
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>プレビュー</CardTitle>
            <CardDescription>
              設定された内容がどのように使用されるかのプレビューです。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm">
                <strong>顧客：</strong>「ご用件を教えてください。」
              </p>
              <p className="text-sm mt-2">
                <strong>AI：</strong>「ありがとうございます。{settings.companyDescription} {settings.callToAction}」
              </p>
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
    </div>
  );
}