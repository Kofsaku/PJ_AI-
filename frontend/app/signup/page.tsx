"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { Loader2 } from "lucide-react";
import { env } from "process";

type FormData = {
  companyId: string;
  companyName: string;
  password: string;
  confirmPassword: string;
  businessName: string;
  businessPhone: string;
  email: string;
  postalCode: string;
  address: string;
  businessType1: string;
  businessType2: string;
  employees: string;
  annualRevenue: string;
  firstName: string;
  lastName: string;
  description: string;
};

type FormErrors = Partial<Record<keyof FormData, string>>;

export default function SignupPage() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    companyId: "",
    companyName: "",
    password: "",
    confirmPassword: "",
    businessName: "",
    businessPhone: "",
    email: "",
    postalCode: "",
    address: "",
    businessType1: "",
    businessType2: "",
    employees: "",
    annualRevenue: "",
    firstName: "",
    lastName: "",
    description: "",
  });
  const [companyValidated, setCompanyValidated] = useState(false);
  const [hasExistingAdmin, setHasExistingAdmin] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const router = useRouter();

  const validateStep = (step: number): boolean => {
    const newErrors: FormErrors = {};

    if (step === 1) {
      if (!formData.companyId.trim()) {
        newErrors.companyId = "企業IDは必須です";
      }
      if (!companyValidated) {
        newErrors.companyId = "企業IDを確認してください";
      }
    }

    if (step === 2) {


      if (!formData.businessName.trim()) {
        newErrors.businessName = "事業者名は必須です";
      }

      if (!formData.businessPhone.trim()) {
        newErrors.businessPhone = "事業者電話番号は必須です";
      } else if (!/^[0-9-]+$/.test(formData.businessPhone)) {
        newErrors.businessPhone = "有効な電話番号を入力してください";
      }

      if (!formData.email.trim()) {
        newErrors.email = "メールアドレスは必須です";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = "有効なメールアドレスを入力してください";
      }

      if (!formData.address.trim()) {
        newErrors.address = "住所は必須です";
      }

      if (!formData.businessType1.trim()) {
        newErrors.businessType1 = "業種1は必須です";
      }

      if (!formData.employees.trim()) {
        newErrors.employees = "社員数は必須です";
      }
    }

    if (step === 3) {
      if (!formData.lastName.trim()) {
        newErrors.lastName = "姓は必須です";
      }
      if (!formData.firstName.trim()) {
        newErrors.firstName = "名は必須です";
      }
      if (!formData.password) {
        newErrors.password = "パスワードは必須です";
      } else if (formData.password.length < 8) {
        newErrors.password = "パスワードは8文字以上必要です";
      }
      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = "パスワードが一致しません";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateStep(step)) return;

    // 既存管理者がいる場合はステップ3をスキップ
    if (step === 2 && hasExistingAdmin) {
      handleSubmit();
      return;
    }

    if (step < 3) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    setSubmitError(null);
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch(
        '/api/auth/signup',
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "登録に失敗しました");
      }

      router.push("/dashboard");
    } catch (error) {
      console.error("Registration error:", error);
      setSubmitError(
        error instanceof Error ? error.message : "登録中にエラーが発生しました"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateFormData = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when field is updated
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    // Reset company validation when company ID changes
    if (field === 'companyId') {
      setCompanyValidated(false);
      setFormData(prev => ({ 
        ...prev, 
        companyName: '',
        businessName: '',
        businessPhone: '',
        email: '',
        postalCode: '',
        address: ''
      }));
    }
  };

  const validateCompanyId = async () => {
    if (!formData.companyId.trim()) {
      setErrors(prev => ({ ...prev, companyId: '企業IDを入力してください' }));
      return;
    }
    
    try {
      const response = await fetch(`/api/companies/validate/${formData.companyId}`);
      const data = await response.json();
      
      if (data.success) {
        setCompanyValidated(true);
        setFormData(prev => ({ 
          ...prev, 
          companyName: data.data.name,
          businessName: data.data.name, // 事業者名にも同じ名前を設定
          businessPhone: data.data.phone || '', // 事業者電話番号を設定
          email: data.data.email || '', // メールアドレスを設定
          postalCode: data.data.postalCode || '', // 郵便番号を設定
          address: data.data.address || '' // 住所を設定
        }));
        setErrors(prev => ({ ...prev, companyId: undefined }));
        
        // 管理者が既に存在するかチェック
        setHasExistingAdmin(data.data.hasAdmin || false);
        
        // 企業ID確認後、自動的に次のステップに進む
        setTimeout(() => {
          setStep(2);
        }, 500);
      } else {
        setCompanyValidated(false);
        setErrors(prev => ({ ...prev, companyId: '無効な企業IDです' }));
      }
    } catch (error) {
      setCompanyValidated(false);
      setErrors(prev => ({ ...prev, companyId: '企業IDの確認に失敗しました' }));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-4">2. 会員登録</h1>
          <div className="flex items-center space-x-4">
            {[1, 2, 3].map((i, index, array) => {
              // 既存管理者がいる場合は3番目のステップを表示しない
              if (i === 3 && hasExistingAdmin) {
                return null;
              }
              return (
                <div key={i} className="flex items-center">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      i <= step
                        ? "bg-orange-500 text-white"
                        : "bg-gray-300 text-gray-600"
                    }`}
                  >
                    {i}
                  </div>
                  {/* 最後の要素でない、または次の要素が表示される場合のみ線を表示 */}
                  {index < array.length - 1 && 
                   !(i === 2 && hasExistingAdmin) && 
                   <div className="w-12 h-0.5 bg-gray-300 mx-2" />}
                </div>
              );
            })}
          </div>
        </div>

        {submitError && (
          <Alert variant="destructive" className="mb-4">
            <ExclamationTriangleIcon className="h-4 w-4" />
            <AlertTitle>エラー</AlertTitle>
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>
              {step === 1 && "企業情報を探す"}
              {step === 2 && "企業情報を入力"}
              {step === 3 && "管理者アカウント作成"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {step === 1 && (
              <>
                <div className="text-center">
                  <p className="text-gray-600 mb-6">企業IDを入力してください。</p>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="companyId">企業ID</Label>
                    <Input
                      id="companyId"
                      value={formData.companyId}
                      onChange={(e) =>
                        updateFormData("companyId", e.target.value)
                      }
                      placeholder="XXXXXX"
                      className={`text-center ${errors.companyId ? "border-red-500" : ""}`}
                    />
                    {errors.companyId && (
                      <p className="text-sm text-red-500 text-center">{errors.companyId}</p>
                    )}
                    {companyValidated && (
                      <p className="text-sm text-green-600 text-center">✓ 企業確認済み: {formData.companyName}</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    onClick={validateCompanyId}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                  >
                    検索する
                  </Button>
                </div>
                {companyValidated && (
                  <div className="p-4 bg-gray-50 rounded-lg text-center">
                    <p className="text-sm text-gray-600">所属企業</p>
                    <p className="font-medium">{formData.companyName}</p>
                  </div>
                )}
              </>
            )}

            {step === 2 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="companyId">企業ID</Label>
                  <Input
                    id="companyId"
                    value={formData.companyId}
                    disabled
                    className="bg-gray-100"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessName">事業者名 *</Label>
                  <Input
                    id="businessName"
                    value={formData.businessName}
                    onChange={(e) => updateFormData("businessName", e.target.value)}
                    placeholder="株式会社○○"
                    className={errors.businessName ? "border-red-500" : ""}
                  />
                  {errors.businessName && (
                    <p className="text-sm text-red-500">{errors.businessName}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessPhone">事業者電話番号 *</Label>
                  <Input
                    id="businessPhone"
                    value={formData.businessPhone}
                    onChange={(e) => updateFormData("businessPhone", e.target.value)}
                    placeholder="03-1234-5678"
                    className={errors.businessPhone ? "border-red-500" : ""}
                  />
                  {errors.businessPhone && (
                    <p className="text-sm text-red-500">{errors.businessPhone}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">メールアドレス *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateFormData("email", e.target.value)}
                    placeholder="admin@company.com"
                    className={errors.email ? "border-red-500" : ""}
                  />
                  {errors.email && (
                    <p className="text-sm text-red-500">{errors.email}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="postalCode">郵便番号</Label>
                  <Input
                    id="postalCode"
                    value={formData.postalCode}
                    onChange={(e) => updateFormData("postalCode", e.target.value)}
                    placeholder="100-0001"
                    className={errors.postalCode ? "border-red-500" : ""}
                  />
                  {errors.postalCode && (
                    <p className="text-sm text-red-500">{errors.postalCode}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">住所 *</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => updateFormData("address", e.target.value)}
                    placeholder="東京都渋谷区..."
                    className={errors.address ? "border-red-500" : ""}
                  />
                  {errors.address && (
                    <p className="text-sm text-red-500">{errors.address}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessType1">業種1 *</Label>
                  <Select
                    value={formData.businessType1}
                    onValueChange={(value) =>
                      updateFormData("businessType1", value)
                    }
                  >
                    <SelectTrigger
                      className={errors.businessType1 ? "border-red-500" : ""}
                    >
                      <SelectValue placeholder="業種を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="it">IT・通信</SelectItem>
                      <SelectItem value="manufacturing">製造業</SelectItem>
                      <SelectItem value="retail">小売業</SelectItem>
                      <SelectItem value="service">サービス業</SelectItem>
                      <SelectItem value="construction">建設業</SelectItem>
                      <SelectItem value="finance">金融業</SelectItem>
                      <SelectItem value="healthcare">医療・福祉</SelectItem>
                      <SelectItem value="education">教育</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.businessType1 && (
                    <p className="text-sm text-red-500">
                      {errors.businessType1}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessType2">業種2</Label>
                  <Select
                    value={formData.businessType2}
                    onValueChange={(value) =>
                      updateFormData("businessType2", value)
                    }
                  >
                    <SelectTrigger
                      className={errors.businessType2 ? "border-red-500" : ""}
                    >
                      <SelectValue placeholder="業種を選択（任意）" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">選択しない</SelectItem>
                      <SelectItem value="it">IT・通信</SelectItem>
                      <SelectItem value="manufacturing">製造業</SelectItem>
                      <SelectItem value="retail">小売業</SelectItem>
                      <SelectItem value="service">サービス業</SelectItem>
                      <SelectItem value="construction">建設業</SelectItem>
                      <SelectItem value="finance">金融業</SelectItem>
                      <SelectItem value="healthcare">医療・福祉</SelectItem>
                      <SelectItem value="education">教育</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.businessType2 && (
                    <p className="text-sm text-red-500">{errors.businessType2}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employees">社員数 *</Label>
                  <Select
                    value={formData.employees}
                    onValueChange={(value) =>
                      updateFormData("employees", value)
                    }
                  >
                    <SelectTrigger
                      className={errors.employees ? "border-red-500" : ""}
                    >
                      <SelectValue placeholder="社員数を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1-10">1-10名</SelectItem>
                      <SelectItem value="11-50">11-50名</SelectItem>
                      <SelectItem value="51-100">51-100名</SelectItem>
                      <SelectItem value="101-300">101-300名</SelectItem>
                      <SelectItem value="301-1000">301-1000名</SelectItem>
                      <SelectItem value="1000+">1000名以上</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.employees && (
                    <p className="text-sm text-red-500">{errors.employees}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="annualRevenue">年間売上</Label>
                  <Select
                    value={formData.annualRevenue}
                    onValueChange={(value) =>
                      updateFormData("annualRevenue", value)
                    }
                  >
                    <SelectTrigger
                      className={errors.annualRevenue ? "border-red-500" : ""}
                    >
                      <SelectValue placeholder="年間売上を選択（任意）" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">選択しない</SelectItem>
                      <SelectItem value="under-10M">1000万円未満</SelectItem>
                      <SelectItem value="10M-50M">1000万円〜5000万円</SelectItem>
                      <SelectItem value="50M-100M">5000万円〜1億円</SelectItem>
                      <SelectItem value="100M-500M">1億円〜5億円</SelectItem>
                      <SelectItem value="500M-1B">5億円〜10億円</SelectItem>
                      <SelectItem value="1B+">10億円以上</SelectItem>
                    </SelectContent>
                  </Select>
                  {errors.annualRevenue && (
                    <p className="text-sm text-red-500">{errors.annualRevenue}</p>
                  )}
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="lastName">姓 *</Label>
                    <Input
                      id="lastName"
                      value={formData.lastName}
                      onChange={(e) =>
                        updateFormData("lastName", e.target.value)
                      }
                      placeholder="田中"
                      className={errors.lastName ? "border-red-500" : ""}
                    />
                    {errors.lastName && (
                      <p className="text-sm text-red-500">{errors.lastName}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="firstName">名 *</Label>
                    <Input
                      id="firstName"
                      value={formData.firstName}
                      onChange={(e) =>
                        updateFormData("firstName", e.target.value)
                      }
                      placeholder="太郎"
                      className={errors.firstName ? "border-red-500" : ""}
                    />
                    {errors.firstName && (
                      <p className="text-sm text-red-500">{errors.firstName}</p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">パスワード *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => updateFormData("password", e.target.value)}
                    placeholder="••••••••"
                    className={errors.password ? "border-red-500" : ""}
                  />
                  {errors.password && (
                    <p className="text-sm text-red-500">{errors.password}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">パスワード確認 *</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) =>
                      updateFormData("confirmPassword", e.target.value)
                    }
                    placeholder="••••••••"
                    className={errors.confirmPassword ? "border-red-500" : ""}
                  />
                  {errors.confirmPassword && (
                    <p className="text-sm text-red-500">
                      {errors.confirmPassword}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">備考</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      updateFormData("description", e.target.value)
                    }
                    placeholder="その他の情報があれば入力してください"
                    rows={4}
                  />
                </div>
              </>
            )}

            <div className="flex justify-between pt-4">
              {step > 1 && (
                <Button variant="outline" onClick={handleBack}>
                  戻る
                </Button>
              )}
              {step !== 1 && (
                <Button
                  onClick={handleNext}
                  className="bg-orange-500 hover:bg-orange-600 ml-auto"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      処理中...
                    </>
                  ) : (step === 3 || (step === 2 && hasExistingAdmin)) ? (
                    "登録完了"
                  ) : (
                    "次へ"
                  )}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
