"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"

type CompanyData = {
  name: string;
  phone: string;
  email: string;
  url: string;
  postalCode: string;
  address: string;
}

export default function CompanyConfirm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [companyData, setCompanyData] = useState<CompanyData>({
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

    // URLパラメータからデータを取得
    const data: CompanyData = {
      name: searchParams.get('name') || '',
      phone: searchParams.get('phone') || '',
      email: searchParams.get('email') || '',
      url: searchParams.get('url') || '',
      postalCode: searchParams.get('postalCode') || '',
      address: searchParams.get('address') || ''
    }

    // 必須項目のチェック
    if (!data.name || !data.phone || !data.address) {
      toast.error('入力データが不足しています');
      router.push('/admin/company-management/register');
      return;
    }

    setCompanyData(data);
  }, [router, searchParams])

  const handleRegister = async () => {
    setLoading(true);
    
    try {
      const response = await fetch('/api/companies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(companyData),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('企業を登録しました');
        router.push('/admin/companies');
      } else {
        toast.error(data.error || '登録に失敗しました');
      }
    } catch (error) {
      console.error('Error creating company:', error);
      toast.error('登録に失敗しました');
    } finally {
      setLoading(false);
    }
  }

  const handleEdit = () => {
    // URLパラメータとして元のフォーム画面に戻る
    const params = new URLSearchParams(companyData);
    router.push(`/admin/company-management/register?${params.toString()}`);
  }

  return (
    <div className="p-8">
      <div className="bg-white rounded-lg shadow-lg max-w-4xl" style={{padding: '60px'}}>
        <p className="text-black" style={{marginBottom: '3.5rem'}}>登録内容に誤りがないか確認してください。</p>
        
        <div className="space-y-6">
          <div className="flex border-b pb-3">
            <div className="w-40 text-gray-600 pr-6">事業者名</div>
            <div className="font-semibold">{companyData.name}</div>
          </div>
          
          <div className="flex border-b pb-3">
            <div className="w-40 text-gray-600 pr-6">電話番号</div>
            <div className="font-semibold">{companyData.phone}</div>
          </div>
          
          {companyData.email && (
            <div className="flex border-b pb-3">
              <div className="w-40 text-gray-600 pr-6">メールアドレス</div>
              <div className="font-semibold">{companyData.email}</div>
            </div>
          )}
          
          {companyData.url && (
            <div className="flex border-b pb-3">
              <div className="w-40 text-gray-600 pr-6">ウェブサイトURL</div>
              <div className="font-semibold">{companyData.url}</div>
            </div>
          )}
          
          {companyData.postalCode && (
            <div className="flex border-b pb-3">
              <div className="w-40 text-gray-600 pr-6">郵便番号</div>
              <div className="font-semibold">{companyData.postalCode}</div>
            </div>
          )}
          
          <div className="flex border-b pb-3">
            <div className="w-40 text-gray-600 pr-6">住所</div>
            <div className="font-semibold flex-1">{companyData.address}</div>
          </div>
        </div>

        <div className="pt-6 flex gap-4">
          <Button 
            type="button" 
            variant="outline"
            className="flex-1 border-orange-500 text-orange-500"
            onClick={handleEdit}
          >
            修正する
          </Button>
          <Button 
            type="button" 
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white"
            disabled={loading}
            onClick={handleRegister}
          >
            {loading ? "登録中..." : "企業情報を登録する"}
          </Button>
        </div>
      </div>
    </div>
  )
}
