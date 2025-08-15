"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sidebar } from "@/components/sidebar"
import { useToast } from "@/components/ui/use-toast"
import { ArrowLeft } from "lucide-react"

// Prefecture mapping
const prefectureMap: { [key: string]: string } = {
  "北海道": "hokkaido",
  "青森県": "aomori",
  "岩手県": "iwate",
  "宮城県": "miyagi",
  "秋田県": "akita",
  "山形県": "yamagata",
  "福島県": "fukushima",
  "茨城県": "ibaraki",
  "栃木県": "tochigi",
  "群馬県": "gunma",
  "埼玉県": "saitama",
  "千葉県": "chiba",
  "東京都": "tokyo",
  "神奈川県": "kanagawa",
  "新潟県": "niigata",
  "富山県": "toyama",
  "石川県": "ishikawa",
  "福井県": "fukui",
  "山梨県": "yamanashi",
  "長野県": "nagano",
  "岐阜県": "gifu",
  "静岡県": "shizuoka",
  "愛知県": "aichi",
  "三重県": "mie",
  "滋賀県": "shiga",
  "京都府": "kyoto",
  "大阪府": "osaka",
  "兵庫県": "hyogo",
  "奈良県": "nara",
  "和歌山県": "wakayama",
  "鳥取県": "tottori",
  "島根県": "shimane",
  "岡山県": "okayama",
  "広島県": "hiroshima",
  "山口県": "yamaguchi",
  "徳島県": "tokushima",
  "香川県": "kagawa",
  "愛媛県": "ehime",
  "高知県": "kochi",
  "福岡県": "fukuoka",
  "佐賀県": "saga",
  "長崎県": "nagasaki",
  "熊本県": "kumamoto",
  "大分県": "oita",
  "宮崎県": "miyazaki",
  "鹿児島県": "kagoshima",
  "沖縄県": "okinawa"
}

export default function CustomerDetailPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    prefecture: "",
    city: "",
    zipCode: "",
    company: "",
    position: "",
    notes: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const customerId = params.id as string

  // Fetch customer data
  useEffect(() => {
    const fetchCustomer = async () => {
      try {
        const response = await fetch(`/api/customers/${customerId}`)
        if (!response.ok) throw new Error("Failed to fetch customer")
        
        const data = await response.json()
        
        // Parse address to extract prefecture and city
        let prefecture = ""
        let city = ""
        let address = ""
        
        if (data.address) {
          // Try to extract prefecture from address
          for (const [prefName, prefValue] of Object.entries(prefectureMap)) {
            if (data.address.includes(prefName)) {
              prefecture = prefValue
              const addressParts = data.address.replace(prefName, "").trim().split(" ")
              if (addressParts.length > 0) {
                city = addressParts[0]
                address = addressParts.slice(1).join(" ")
              }
              break
            }
          }
          
          // If no prefecture found, use the full address
          if (!prefecture) {
            address = data.address
          }
        }
        
        setFormData({
          name: data.customer || "",
          email: data.email || "",
          phone: data.phone || "",
          address: address,
          prefecture: prefecture,
          city: city,
          zipCode: data.zipCode || "",
          company: data.company || "",
          position: data.position || "",
          notes: data.notes || "",
        })
      } catch (error) {
        toast({
          title: "エラー",
          description: "顧客情報の取得に失敗しました",
          variant: "destructive",
        })
        router.push("/dashboard")
      } finally {
        setIsLoading(false)
      }
    }

    if (customerId) {
      fetchCustomer()
    }
  }, [customerId, toast, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Get prefecture name from value
      const prefectureName = Object.keys(prefectureMap).find(
        key => prefectureMap[key] === formData.prefecture
      ) || formData.prefecture

      // Prepare customer data for API
      const customerData = {
        customer: formData.name,
        address: prefectureName ? 
          `${prefectureName} ${formData.city} ${formData.address}` : 
          `${formData.city} ${formData.address}`.trim(),
        email: formData.email,
        phone: formData.phone,
        company: formData.company,
        position: formData.position,
        zipCode: formData.zipCode,
        notes: formData.notes
      }

      const response = await fetch(`/api/customers/${customerId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(customerData),
      })

      if (!response.ok) {
        throw new Error('Failed to update customer')
      }

      toast({
        title: "成功",
        description: "顧客情報を更新しました",
      })

      setIsEditing(false)
    } catch (error) {
      toast({
        title: "エラー",
        description: "顧客情報の更新に失敗しました",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const updateFormData = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleDelete = async () => {
    if (!confirm("この顧客を削除してもよろしいですか？")) {
      return
    }

    try {
      const response = await fetch(`/api/customers/${customerId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete customer')
      }

      toast({
        title: "成功",
        description: "顧客を削除しました",
      })

      router.push("/dashboard")
    } catch (error) {
      toast({
        title: "エラー",
        description: "顧客の削除に失敗しました",
        variant: "destructive",
      })
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 p-6 flex items-center justify-center">
          <div>読み込み中...</div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1 p-6">
        <div className="max-w-2xl">
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/dashboard")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold">顧客詳細</h1>
          </div>

          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>顧客情報</CardTitle>
                <div className="flex gap-2">
                  {!isEditing ? (
                    <Button
                      variant="outline"
                      onClick={() => setIsEditing(true)}
                    >
                      編集
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => setIsEditing(false)}
                      disabled={isSubmitting}
                    >
                      キャンセル
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={isSubmitting}
                  >
                    削除
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">氏名 *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => updateFormData("name", e.target.value)}
                      placeholder="田中太郎"
                      required
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">メールアドレス</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => updateFormData("email", e.target.value)}
                      placeholder="tanaka@example.com"
                      disabled={!isEditing}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="phone">電話番号</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => updateFormData("phone", e.target.value)}
                      placeholder="090-1234-5678"
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zipCode">郵便番号</Label>
                    <Input
                      id="zipCode"
                      value={formData.zipCode}
                      onChange={(e) => updateFormData("zipCode", e.target.value)}
                      placeholder="123-4567"
                      disabled={!isEditing}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="prefecture">都道府県</Label>
                    <Select 
                      value={formData.prefecture} 
                      onValueChange={(value) => updateFormData("prefecture", value)}
                      disabled={!isEditing}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="選択してください" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hokkaido">北海道</SelectItem>
                        <SelectItem value="aomori">青森県</SelectItem>
                        <SelectItem value="iwate">岩手県</SelectItem>
                        <SelectItem value="miyagi">宮城県</SelectItem>
                        <SelectItem value="akita">秋田県</SelectItem>
                        <SelectItem value="yamagata">山形県</SelectItem>
                        <SelectItem value="fukushima">福島県</SelectItem>
                        <SelectItem value="ibaraki">茨城県</SelectItem>
                        <SelectItem value="tochigi">栃木県</SelectItem>
                        <SelectItem value="gunma">群馬県</SelectItem>
                        <SelectItem value="saitama">埼玉県</SelectItem>
                        <SelectItem value="chiba">千葉県</SelectItem>
                        <SelectItem value="tokyo">東京都</SelectItem>
                        <SelectItem value="kanagawa">神奈川県</SelectItem>
                        <SelectItem value="niigata">新潟県</SelectItem>
                        <SelectItem value="toyama">富山県</SelectItem>
                        <SelectItem value="ishikawa">石川県</SelectItem>
                        <SelectItem value="fukui">福井県</SelectItem>
                        <SelectItem value="yamanashi">山梨県</SelectItem>
                        <SelectItem value="nagano">長野県</SelectItem>
                        <SelectItem value="gifu">岐阜県</SelectItem>
                        <SelectItem value="shizuoka">静岡県</SelectItem>
                        <SelectItem value="aichi">愛知県</SelectItem>
                        <SelectItem value="mie">三重県</SelectItem>
                        <SelectItem value="shiga">滋賀県</SelectItem>
                        <SelectItem value="kyoto">京都府</SelectItem>
                        <SelectItem value="osaka">大阪府</SelectItem>
                        <SelectItem value="hyogo">兵庫県</SelectItem>
                        <SelectItem value="nara">奈良県</SelectItem>
                        <SelectItem value="wakayama">和歌山県</SelectItem>
                        <SelectItem value="tottori">鳥取県</SelectItem>
                        <SelectItem value="shimane">島根県</SelectItem>
                        <SelectItem value="okayama">岡山県</SelectItem>
                        <SelectItem value="hiroshima">広島県</SelectItem>
                        <SelectItem value="yamaguchi">山口県</SelectItem>
                        <SelectItem value="tokushima">徳島県</SelectItem>
                        <SelectItem value="kagawa">香川県</SelectItem>
                        <SelectItem value="ehime">愛媛県</SelectItem>
                        <SelectItem value="kochi">高知県</SelectItem>
                        <SelectItem value="fukuoka">福岡県</SelectItem>
                        <SelectItem value="saga">佐賀県</SelectItem>
                        <SelectItem value="nagasaki">長崎県</SelectItem>
                        <SelectItem value="kumamoto">熊本県</SelectItem>
                        <SelectItem value="oita">大分県</SelectItem>
                        <SelectItem value="miyazaki">宮崎県</SelectItem>
                        <SelectItem value="kagoshima">鹿児島県</SelectItem>
                        <SelectItem value="okinawa">沖縄県</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">市区町村</Label>
                    <Input
                      id="city"
                      value={formData.city}
                      onChange={(e) => updateFormData("city", e.target.value)}
                      placeholder="渋谷区"
                      disabled={!isEditing}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">住所</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => updateFormData("address", e.target.value)}
                    placeholder="道玄坂1-2-3"
                    disabled={!isEditing}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="company">会社名</Label>
                    <Input
                      id="company"
                      value={formData.company}
                      onChange={(e) => updateFormData("company", e.target.value)}
                      placeholder="株式会社サンプル"
                      disabled={!isEditing}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="position">役職</Label>
                    <Input
                      id="position"
                      value={formData.position}
                      onChange={(e) => updateFormData("position", e.target.value)}
                      placeholder="営業部長"
                      disabled={!isEditing}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">備考</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => updateFormData("notes", e.target.value)}
                    placeholder="その他の情報"
                    rows={3}
                    disabled={!isEditing}
                  />
                </div>

                {isEditing && (
                  <div className="flex justify-end space-x-2 pt-4">
                    <Button 
                      type="submit" 
                      className="bg-orange-500 hover:bg-orange-600"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? "更新中..." : "更新する"}
                    </Button>
                  </div>
                )}
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}