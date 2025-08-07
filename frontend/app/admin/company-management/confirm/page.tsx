"use client"

import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"

export default function CompanyConfirm() {
  const router = useRouter()

  const companyData = {
    companyId: "XXXXXX",
    accountName: "aicall",
    password: "XXXXXXXX",
    companyName: "株式会社AICALL",
    companyNameKana: "カブシキガイシャエーアイコール",
    phone: "03-123-4567",
    email: "XXXXXXX@aicall.com",
    postalCode: "000-0000",
    address: "東京都新宿区新宿０丁目０番地０号新宿ビル１",
    industry1: "情報通信業",
    industry2: "通信業",
    employeeCount: "〜50名",
    annualSales: "〜5000万"
  }

  const handleRegister = () => {
    router.push("/admin/company-management/complete")
  }

  const handleEdit = () => {
    router.push("/admin/company-management/register")
  }

  return (
    <div className="p-8">
      <div className="bg-white rounded-lg p-6 max-w-2xl">
        <p className="mb-6 text-gray-600">登録内容に誤りがないか確認してください。</p>
        
        <div className="space-y-4">
          <div className="flex border-b pb-2">
            <div className="w-32 text-gray-600">企業ID</div>
            <div>{companyData.companyId}</div>
          </div>
          
          <div className="flex border-b pb-2">
            <div className="w-32 text-gray-600">アカウント名</div>
            <div>{companyData.accountName}</div>
          </div>
          
          <div className="flex border-b pb-2">
            <div className="w-32 text-gray-600">パスワード</div>
            <div>{companyData.password}</div>
          </div>
          
          <div className="flex border-b pb-2">
            <div className="w-32 text-gray-600">事業者名</div>
            <div>{companyData.companyName}</div>
          </div>
          
          <div className="flex border-b pb-2">
            <div className="w-32 text-gray-600">事業者名（カナ）</div>
            <div>{companyData.companyNameKana}</div>
          </div>
          
          <div className="flex border-b pb-2">
            <div className="w-32 text-gray-600">事業者電話番号</div>
            <div>{companyData.phone}</div>
          </div>
          
          <div className="flex border-b pb-2">
            <div className="w-32 text-gray-600">メールアドレス</div>
            <div>{companyData.email}</div>
          </div>
          
          <div className="flex border-b pb-2">
            <div className="w-32 text-gray-600">郵便番号</div>
            <div>{companyData.postalCode}</div>
          </div>
          
          <div className="flex border-b pb-2">
            <div className="w-32 text-gray-600">住所</div>
            <div>{companyData.address}</div>
          </div>
          
          <div className="flex border-b pb-2">
            <div className="w-32 text-gray-600">業種1</div>
            <div>{companyData.industry1}</div>
          </div>
          
          <div className="flex border-b pb-2">
            <div className="w-32 text-gray-600">業種2</div>
            <div>{companyData.industry2}</div>
          </div>
          
          <div className="flex border-b pb-2">
            <div className="w-32 text-gray-600">社員数</div>
            <div>{companyData.employeeCount}</div>
          </div>
          
          <div className="flex border-b pb-2">
            <div className="w-32 text-gray-600">年間売上</div>
            <div>{companyData.annualSales}</div>
          </div>
        </div>

        <div className="flex gap-4 pt-6">
          <Button 
            onClick={handleRegister}
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-full"
          >
            企業情報を登録する
          </Button>
          <Button 
            onClick={handleEdit}
            variant="outline" 
            className="flex-1 border-orange-500 text-orange-500 hover:bg-orange-50 py-3 rounded-full"
          >
            修正する
          </Button>
        </div>
      </div>
    </div>
  )
}
