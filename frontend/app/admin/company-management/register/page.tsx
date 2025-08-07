"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useRouter } from "next/navigation"

export default function CompanyRegister() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    companyId: "XXXXXX",
    companyName: "",
    companyNameKana: "",
    phone1: "",
    phone2: "",
    phone3: "",
    email: "",
    postalCode1: "",
    postalCode2: "",
    prefecture: "",
    city: "",
    ward: "",
    address: "",
    building: "",
    industry1: "",
    industry2: "",
    employeeCount: "",
    annualSales: ""
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    router.push("/admin/company-management/confirm")
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">新規登録</h1>
      
      <div className="bg-white rounded-lg p-6 max-w-2xl">
        <p className="mb-6 text-gray-600">企業情報の登録をしてください。</p>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label>企業ID</Label>
            <div className="text-gray-500 py-2 border-b">{formData.companyId}</div>
          </div>

          <div>
            <Label htmlFor="companyName">事業者名</Label>
            <Input
              id="companyName"
              placeholder="株式会社○○"
              value={formData.companyName}
              onChange={(e) => setFormData({...formData, companyName: e.target.value})}
            />
          </div>

          <div>
            <Label htmlFor="companyNameKana">事業者名（カナ）</Label>
            <Input
              id="companyNameKana"
              placeholder="カブシキガイシャ○○"
              value={formData.companyNameKana}
              onChange={(e) => setFormData({...formData, companyNameKana: e.target.value})}
            />
          </div>

          <div>
            <Label>事業者電話番号</Label>
            <div className="flex gap-2">
              <Input
                placeholder="03"
                className="w-20"
                value={formData.phone1}
                onChange={(e) => setFormData({...formData, phone1: e.target.value})}
              />
              <span className="py-2">—</span>
              <Input
                placeholder="123"
                className="w-20"
                value={formData.phone2}
                onChange={(e) => setFormData({...formData, phone2: e.target.value})}
              />
              <span className="py-2">—</span>
              <Input
                placeholder="4567"
                className="w-24"
                value={formData.phone3}
                onChange={(e) => setFormData({...formData, phone3: e.target.value})}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="email">メールアドレス</Label>
            <Input
              id="email"
              type="email"
              placeholder="XXXXXXX@aicall.com"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
            />
          </div>

          <div>
            <Label>郵便番号（半角数字）</Label>
            <div className="flex gap-2">
              <Input
                placeholder="000"
                className="w-20"
                value={formData.postalCode1}
                onChange={(e) => setFormData({...formData, postalCode1: e.target.value})}
              />
              <span className="py-2">—</span>
              <Input
                placeholder="0000"
                className="w-24"
                value={formData.postalCode2}
                onChange={(e) => setFormData({...formData, postalCode2: e.target.value})}
              />
            </div>
          </div>

          <div>
            <Label>住所</Label>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Select value={formData.prefecture} onValueChange={(value) => setFormData({...formData, prefecture: value})}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="東京都" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tokyo">東京都</SelectItem>
                    <SelectItem value="osaka">大阪府</SelectItem>
                    <SelectItem value="kyoto">京都府</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="新宿区"
                  className="w-32"
                  value={formData.city}
                  onChange={(e) => setFormData({...formData, city: e.target.value})}
                />
                <Input
                  placeholder="新宿"
                  className="w-32"
                  value={formData.ward}
                  onChange={(e) => setFormData({...formData, ward: e.target.value})}
                />
              </div>
              <Input
                placeholder="０丁目０番地０号"
                value={formData.address}
                onChange={(e) => setFormData({...formData, address: e.target.value})}
              />
              <Input
                placeholder="ビル名"
                value={formData.building}
                onChange={(e) => setFormData({...formData, building: e.target.value})}
              />
            </div>
          </div>

          <div>
            <Label>業種</Label>
            <div className="flex gap-2">
              <Select value={formData.industry1} onValueChange={(value) => setFormData({...formData, industry1: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="業種1" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="it">情報通信業</SelectItem>
                  <SelectItem value="manufacturing">製造業</SelectItem>
                  <SelectItem value="service">サービス業</SelectItem>
                </SelectContent>
              </Select>
              <Select value={formData.industry2} onValueChange={(value) => setFormData({...formData, industry2: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="業種2" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="telecom">通信業</SelectItem>
                  <SelectItem value="software">ソフトウェア業</SelectItem>
                  <SelectItem value="consulting">コンサルティング業</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <Label>社員数</Label>
              <Select value={formData.employeeCount} onValueChange={(value) => setFormData({...formData, employeeCount: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="〜50名" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1-10">〜10名</SelectItem>
                  <SelectItem value="11-50">〜50名</SelectItem>
                  <SelectItem value="51-100">〜100名</SelectItem>
                  <SelectItem value="101-500">〜500名</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label>年間売上</Label>
              <Select value={formData.annualSales} onValueChange={(value) => setFormData({...formData, annualSales: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="〜5000万" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0-1000">〜1000万</SelectItem>
                  <SelectItem value="1000-5000">〜5000万</SelectItem>
                  <SelectItem value="5000-10000">〜1億</SelectItem>
                  <SelectItem value="10000+">1億以上</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="pt-4">
            <Button type="submit" className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-full">
              企業情報を登録する
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
