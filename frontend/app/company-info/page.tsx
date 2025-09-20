"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Sidebar } from "@/components/sidebar"
import { Building, MapPin, Phone, Mail, Globe, Users, Calendar, CreditCard } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function CompanyInfoPage() {
  const [companyData, setCompanyData] = useState<any>(null)
  const { toast } = useToast()

  useEffect(() => {
    fetchCompanyData()
  }, [])

  const fetchCompanyData = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        // Fallback to localStorage data
        const storedUserData = localStorage.getItem('userData')
        if (storedUserData) {
          const data = JSON.parse(storedUserData)
          const userData = data.user || data.data || data
          const company = {
            name: userData.companyName,
            companyId: userData.companyId,
            id: userData.companyId,
            department: userData.department,
            position: userData.position
          }
          setCompanyData(company)
        }
        return
      }

      // Fetch company data from API
      const apiUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001'
      const response = await fetch(`${apiUrl}/api/company/my-company`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const result = await response.json()
        if (result.success) {
          const company = result.data
          setCompanyData(company)
          
          // Also update localStorage with the latest company info
          const storedUserData = localStorage.getItem('userData')
          if (storedUserData) {
            const data = JSON.parse(storedUserData)
            const userData = data.user || data.data || data
            userData.companyName = company.name
            userData.companyId = company.companyId
            localStorage.setItem('userData', JSON.stringify({ user: userData }))
          }
        }
      } else {
        // Fallback to localStorage if API fails
        const storedUserData = localStorage.getItem('userData')
        if (storedUserData) {
          const data = JSON.parse(storedUserData)
          const userData = data.user || data.data || data
          const company = {
            name: userData.companyName,
            companyId: userData.companyId,
            id: userData.companyId,
            department: userData.department,
            position: userData.position
          }
          setCompanyData(company)
        }
      }
    } catch (error) {
      console.error("Error fetching company data:", error)
      
      // Fallback to localStorage on error
      const storedUserData = localStorage.getItem('userData')
      if (storedUserData) {
        try {
          const data = JSON.parse(storedUserData)
          const userData = data.user || data.data || data
          const company = {
            name: userData.companyName,
            companyId: userData.companyId,
            id: userData.companyId,
            department: userData.department,
            position: userData.position
          }
          setCompanyData(company)
        } catch (parseError) {
          console.error("Error parsing stored user data:", parseError)
        }
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />

      <main className="ml-64 p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold">会社情報</h1>
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
                  <p className="text-sm text-gray-500">会社名</p>
                  <p className="text-lg font-medium">{companyData.name || "未設定"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">会社ID</p>
                  <p className="text-lg font-medium text-gray-400">{companyData.companyId || companyData.id || companyData._id || "未設定"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">業種</p>
                  <p className="text-lg font-medium">{companyData.industry || "未設定"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">規模</p>
                  <p className="text-lg font-medium">{companyData.size || companyData.employeeCount || "未設定"}</p>
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
                  <p className="text-sm text-gray-500">住所</p>
                  <p className="text-lg font-medium">{companyData.address || "未設定"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">郵便番号</p>
                  <p className="text-lg font-medium">{companyData.postalCode || "未設定"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">都道府県</p>
                  <p className="text-lg font-medium">{companyData.prefecture || "未設定"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">市区町村</p>
                  <p className="text-lg font-medium">{companyData.city || "未設定"}</p>
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
                  <p className="text-sm text-gray-500">代表電話番号</p>
                  <p className="text-lg font-medium">{companyData.phone || companyData.mainPhone || "未設定"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">FAX番号</p>
                  <p className="text-lg font-medium">{companyData.fax || "未設定"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">メールアドレス</p>
                  <p className="text-lg font-medium">{companyData.email || companyData.contactEmail || "未設定"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">ウェブサイト</p>
                  <p className="text-lg font-medium">
                    {companyData.website ? (
                      <a href={companyData.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        {companyData.website}
                      </a>
                    ) : "未設定"}
                  </p>
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
                  <p className="text-sm text-gray-500">部署</p>
                  <p className="text-lg font-medium">{companyData.department || "未設定"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">役職</p>
                  <p className="text-lg font-medium">{companyData.position || "未設定"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">チーム</p>
                  <p className="text-lg font-medium">{companyData.team || "未設定"}</p>
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
                  <p className="text-sm text-gray-500">プラン</p>
                  <p className="text-lg font-medium">{companyData.plan || companyData.subscriptionPlan || "未設定"}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">契約状態</p>
                  <p className="text-lg font-medium">
                    <span className={`px-2 py-1 rounded text-sm ${companyData.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
                      {companyData.status === "active" ? "アクティブ" : companyData.status || "未設定"}
                    </span>
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">ライセンス数</p>
                  <p className="text-lg font-medium">{companyData.licenses || companyData.userLimit || "未設定"}</p>
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