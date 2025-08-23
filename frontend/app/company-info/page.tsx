"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sidebar } from "@/components/sidebar"
import { Building, MapPin, Phone, Mail, Globe, Users, Calendar, CreditCard, Edit2, Save, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function CompanyInfoPage() {
  const [companyData, setCompanyData] = useState<any>(null)
  const [editMode, setEditMode] = useState(false)
  const [editedData, setEditedData] = useState<any>(null)
  const { toast } = useToast()

  useEffect(() => {
    // LocalStorageからユーザーデータを取得し、会社情報を抽出
    const storedUserData = localStorage.getItem('userData')
    if (storedUserData) {
      try {
        const data = JSON.parse(storedUserData)
        const userData = data.user || data.data || data
        // 会社情報はユーザーデータ内のcompanyオブジェクトまたは個別のフィールドから取得
        const company = userData.company || {
          name: userData.companyName,
          id: userData.companyId,
          department: userData.department,
          position: userData.position
        }
        setCompanyData(company)
        setEditedData(company)
      } catch (error) {
        console.error("Error parsing company data:", error)
      }
    }
  }, [])

  const handleSave = () => {
    // LocalStorageのユーザーデータを更新
    const storedUserData = localStorage.getItem('userData')
    if (storedUserData) {
      const data = JSON.parse(storedUserData)
      const userData = data.user || data.data || data
      userData.company = editedData
      localStorage.setItem('userData', JSON.stringify({ user: userData }))
    }
    setCompanyData(editedData)
    setEditMode(false)
    toast({
      title: "保存完了",
      description: "会社情報が更新されました。",
    })
  }

  const handleCancel = () => {
    setEditedData(companyData)
    setEditMode(false)
  }

  const handleInputChange = (field: string, value: string) => {
    setEditedData({ ...editedData, [field]: value })
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1 p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">会社情報</h1>
          <div className="flex gap-2">
            {editMode ? (
              <>
                <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700">
                  <Save className="h-4 w-4 mr-2" />
                  保存
                </Button>
                <Button onClick={handleCancel} variant="outline">
                  <X className="h-4 w-4 mr-2" />
                  キャンセル
                </Button>
              </>
            ) : (
              <Button onClick={() => setEditMode(true)} className="bg-blue-600 hover:bg-blue-700">
                <Edit2 className="h-4 w-4 mr-2" />
                編集
              </Button>
            )}
          </div>
        </div>

        {companyData ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  基本情報
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm text-gray-500">会社名</Label>
                  {editMode ? (
                    <Input
                      value={editedData?.name || ""}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                      className="mt-1"
                    />
                  ) : (
                    <p className="text-lg font-medium">{companyData.name || "未設定"}</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm text-gray-500">会社ID</Label>
                  <p className="text-lg font-medium text-gray-400">{companyData.id || companyData._id || "未設定"}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">業種</Label>
                  {editMode ? (
                    <Input
                      value={editedData?.industry || ""}
                      onChange={(e) => handleInputChange("industry", e.target.value)}
                      className="mt-1"
                    />
                  ) : (
                    <p className="text-lg font-medium">{companyData.industry || "未設定"}</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm text-gray-500">規模</Label>
                  {editMode ? (
                    <Input
                      value={editedData?.size || editedData?.employeeCount || ""}
                      onChange={(e) => handleInputChange("size", e.target.value)}
                      className="mt-1"
                    />
                  ) : (
                    <p className="text-lg font-medium">{companyData.size || companyData.employeeCount || "未設定"}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  所在地情報
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm text-gray-500">住所</Label>
                  {editMode ? (
                    <Input
                      value={editedData?.address || ""}
                      onChange={(e) => handleInputChange("address", e.target.value)}
                      className="mt-1"
                    />
                  ) : (
                    <p className="text-lg font-medium">{companyData.address || "未設定"}</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm text-gray-500">郵便番号</Label>
                  {editMode ? (
                    <Input
                      value={editedData?.postalCode || ""}
                      onChange={(e) => handleInputChange("postalCode", e.target.value)}
                      className="mt-1"
                      placeholder="000-0000"
                    />
                  ) : (
                    <p className="text-lg font-medium">{companyData.postalCode || "未設定"}</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm text-gray-500">都道府県</Label>
                  {editMode ? (
                    <Input
                      value={editedData?.prefecture || ""}
                      onChange={(e) => handleInputChange("prefecture", e.target.value)}
                      className="mt-1"
                    />
                  ) : (
                    <p className="text-lg font-medium">{companyData.prefecture || "未設定"}</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm text-gray-500">市区町村</Label>
                  {editMode ? (
                    <Input
                      value={editedData?.city || ""}
                      onChange={(e) => handleInputChange("city", e.target.value)}
                      className="mt-1"
                    />
                  ) : (
                    <p className="text-lg font-medium">{companyData.city || "未設定"}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  連絡先情報
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm text-gray-500">代表電話番号</Label>
                  {editMode ? (
                    <Input
                      type="tel"
                      value={editedData?.phone || editedData?.mainPhone || ""}
                      onChange={(e) => handleInputChange("phone", e.target.value)}
                      className="mt-1"
                    />
                  ) : (
                    <p className="text-lg font-medium">{companyData.phone || companyData.mainPhone || "未設定"}</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm text-gray-500">FAX番号</Label>
                  {editMode ? (
                    <Input
                      type="tel"
                      value={editedData?.fax || ""}
                      onChange={(e) => handleInputChange("fax", e.target.value)}
                      className="mt-1"
                    />
                  ) : (
                    <p className="text-lg font-medium">{companyData.fax || "未設定"}</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm text-gray-500">メールアドレス</Label>
                  {editMode ? (
                    <Input
                      type="email"
                      value={editedData?.email || editedData?.contactEmail || ""}
                      onChange={(e) => handleInputChange("email", e.target.value)}
                      className="mt-1"
                    />
                  ) : (
                    <p className="text-lg font-medium">{companyData.email || companyData.contactEmail || "未設定"}</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm text-gray-500">ウェブサイト</Label>
                  {editMode ? (
                    <Input
                      type="url"
                      value={editedData?.website || ""}
                      onChange={(e) => handleInputChange("website", e.target.value)}
                      className="mt-1"
                      placeholder="https://example.com"
                    />
                  ) : (
                    <p className="text-lg font-medium">
                      {companyData.website ? (
                        <a href={companyData.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          {companyData.website}
                        </a>
                      ) : "未設定"}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  所属情報
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm text-gray-500">部署</Label>
                  {editMode ? (
                    <Input
                      value={editedData?.department || ""}
                      onChange={(e) => handleInputChange("department", e.target.value)}
                      className="mt-1"
                    />
                  ) : (
                    <p className="text-lg font-medium">{companyData.department || "未設定"}</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm text-gray-500">役職</Label>
                  {editMode ? (
                    <Input
                      value={editedData?.position || ""}
                      onChange={(e) => handleInputChange("position", e.target.value)}
                      className="mt-1"
                    />
                  ) : (
                    <p className="text-lg font-medium">{companyData.position || "未設定"}</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm text-gray-500">チーム</Label>
                  {editMode ? (
                    <Input
                      value={editedData?.team || ""}
                      onChange={(e) => handleInputChange("team", e.target.value)}
                      className="mt-1"
                    />
                  ) : (
                    <p className="text-lg font-medium">{companyData.team || "未設定"}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  契約情報
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm text-gray-500">プラン</Label>
                  {editMode ? (
                    <Input
                      value={editedData?.plan || editedData?.subscriptionPlan || ""}
                      onChange={(e) => handleInputChange("plan", e.target.value)}
                      className="mt-1"
                    />
                  ) : (
                    <p className="text-lg font-medium">{companyData.plan || companyData.subscriptionPlan || "未設定"}</p>
                  )}
                </div>
                <div>
                  <Label className="text-sm text-gray-500">契約状態</Label>
                  <p className="text-lg font-medium">
                    <span className={`px-2 py-1 rounded text-sm ${companyData.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
                      {companyData.status === "active" ? "アクティブ" : companyData.status || "未設定"}
                    </span>
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-gray-500">ライセンス数</Label>
                  {editMode ? (
                    <Input
                      type="number"
                      value={editedData?.licenses || editedData?.userLimit || ""}
                      onChange={(e) => handleInputChange("licenses", e.target.value)}
                      className="mt-1"
                    />
                  ) : (
                    <p className="text-lg font-medium">{companyData.licenses || companyData.userLimit || "未設定"}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  登録情報
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500">登録日</p>
                  <p className="text-lg font-medium">
                    {companyData.createdAt ? new Date(companyData.createdAt).toLocaleDateString('ja-JP') : "未設定"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">最終更新日</p>
                  <p className="text-lg font-medium">
                    {companyData.updatedAt ? new Date(companyData.updatedAt).toLocaleDateString('ja-JP') : "未設定"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">契約更新日</p>
                  <p className="text-lg font-medium">
                    {companyData.renewalDate ? new Date(companyData.renewalDate).toLocaleDateString('ja-JP') : "未設定"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-gray-500">会社情報を読み込み中...</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}