"use client"

import { useState, useEffect, Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"

function CompanyRegisterContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    url: "",
    postalCode: "",
    address: ""
  })

  useEffect(() => {
    const userData = localStorage.getItem('userData');
    if (!userData) {
      router.push('/admin/login');
      return;
    }
    const user = JSON.parse(userData);
    if (user.role !== 'admin') {
      router.push('/admin/login');
      return;
    }

    // URLパラメータから初期値を設定（確認画面から戻ってきた場合）
    const params = {
      name: searchParams.get('name') || '',
      phone: searchParams.get('phone') || '',
      email: searchParams.get('email') || '',
      url: searchParams.get('url') || '',
      postalCode: searchParams.get('postalCode') || '',
      address: searchParams.get('address') || ''
    };

    // パラメータが存在する場合のみformDataを更新
    if (params.name || params.phone || params.address) {
      setFormData(params);
    }
  }, [router, searchParams])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name || !formData.address || !formData.phone) {
      toast.error('必須項目を入力してください');
      return;
    }

    // URLパラメータとして確認画面に遷移
    const params = new URLSearchParams(formData);
    router.push(`/admin/company-management/confirm?${params.toString()}`);
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">企業新規登録</h1>
      
      <div className="bg-white rounded-lg p-6 max-w-2xl">
        <p className="mb-6 text-gray-600">企業情報を登録してください。企業IDは自動的に生成されます。</p>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="name">事業者名 *</Label>
            <Input
              id="name"
              placeholder="株式会社○○"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              required
            />
          </div>

          <div>
            <Label htmlFor="phone">電話番号 *</Label>
            <Input
              id="phone"
              placeholder="03-1234-5678"
              value={formData.phone}
              onChange={(e) => setFormData({...formData, phone: e.target.value})}
              required
            />
          </div>

          <div>
            <Label htmlFor="email">メールアドレス</Label>
            <Input
              id="email"
              type="email"
              placeholder="info@example.com"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
            />
          </div>

          <div>
            <Label htmlFor="url">ウェブサイトURL</Label>
            <Input
              id="url"
              type="url"
              placeholder="https://example.com"
              value={formData.url}
              onChange={(e) => setFormData({...formData, url: e.target.value})}
            />
          </div>

          <div>
            <Label htmlFor="postalCode">郵便番号</Label>
            <Input
              id="postalCode"
              placeholder="123-4567"
              value={formData.postalCode}
              onChange={(e) => setFormData({...formData, postalCode: e.target.value})}
            />
          </div>

          <div>
            <Label htmlFor="address">住所 *</Label>
            <Input
              id="address"
              placeholder="東京都新宿区..."
              value={formData.address}
              onChange={(e) => setFormData({...formData, address: e.target.value})}
              required
            />
          </div>

          <div className="pt-4 flex gap-4">
            <Button 
              type="button" 
              variant="outline"
              className="flex-1"
              onClick={() => router.push('/admin/companies')}
            >
              キャンセル
            </Button>
            <Button 
              type="submit" 
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
            >
              確認画面へ
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function CompanyRegister() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CompanyRegisterContent />
    </Suspense>
  )
}