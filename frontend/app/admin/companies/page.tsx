"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Search, Filter, Plus, ChevronLeft, ChevronRight } from 'lucide-react'
import { useRouter } from "next/navigation"

const companies = [
  { id: "XXXXXX", name: "企業名1", address: "住所1", url: "URL1", phone: "電話番号1", lastCall: "2025/03/01" },
  { id: "XXXXXX", name: "企業名2", address: "住所2", url: "URL2", phone: "電話番号2", lastCall: "2025/03/01" },
  { id: "XXXXXX", name: "企業名3", address: "住所3", url: "URL3", phone: "電話番号3", lastCall: "2025/03/01" },
  { id: "XXXXXX", name: "企業名4", address: "住所4", url: "URL4", phone: "電話番号4", lastCall: "2025/03/01" },
  { id: "XXXXXX", name: "企業名5", address: "住所5", url: "URL5", phone: "電話番号5", lastCall: "2025/03/01" },
  { id: "XXXXXX", name: "企業名6", address: "住所6", url: "URL6", phone: "電話番号6", lastCall: "2025/03/01" },
]

export default function CompanyList() {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCompanies, setSelectedCompanies] = useState<string[]>([])

  const handleNewRegistration = () => {
    router.push("/admin/company-management/register")
  }

  const handleCSVExport = () => {
    // Show CSV export modal
    const modal = document.createElement('div')
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'
    modal.innerHTML = `
      <div class="bg-white rounded-lg p-8 max-w-md mx-auto text-center">
        <h2 class="text-xl font-bold mb-4">CSVでエクスポート</h2>
        <p class="text-gray-600 mb-6">CSVでエクスポートをします。</p>
        <div class="w-16 h-16 mx-auto mb-4 border-4 border-gray-200 border-t-orange-500 rounded-full animate-spin"></div>
        <p class="text-sm text-gray-500 mb-8">すべての項目をエクスポートします。</p>
        <button class="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-full" onclick="this.parentElement.parentElement.remove()">
          エクスポートを開始する
        </button>
      </div>
    `
    document.body.appendChild(modal)
    
    // Simulate export completion after 2 seconds
    setTimeout(() => {
      modal.innerHTML = `
        <div class="bg-white rounded-lg p-8 max-w-md mx-auto text-center">
          <h2 class="text-xl font-bold mb-4">エクスポート完了</h2>
          <p class="text-gray-600 mb-6">CSVエクスポートが完了しました。</p>
          <div class="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <svg class="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"></path>
            </svg>
          </div>
          <p class="text-sm text-gray-500 mb-2">ファイル名: 新規リスト1</p>
          <p class="text-sm text-gray-500 mb-8">日時: 2025/04/01</p>
          <button class="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-full" onclick="this.parentElement.parentElement.remove()">
            企業一覧へ戻る
          </button>
        </div>
      `
    }, 2000)
  }

  const toggleCompanySelection = (companyId: string) => {
    setSelectedCompanies(prev => 
      prev.includes(companyId) 
        ? prev.filter(id => id !== companyId)
        : [...prev, companyId]
    )
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">企業一覧</h1>
        <div className="flex gap-2">
          <Button 
            onClick={handleCSVExport}
            variant="outline" 
            className="border-orange-500 text-orange-500 hover:bg-orange-50"
          >
            CSV出力
          </Button>
          <Button 
            onClick={handleNewRegistration}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            新規登録
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg p-6">
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="顧客検索"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select>
            <SelectTrigger className="w-32">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="検索条件" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              <SelectItem value="active">アクティブ</SelectItem>
              <SelectItem value="inactive">非アクティブ</SelectItem>
            </SelectContent>
          </Select>
          <Select>
            <SelectTrigger className="w-32">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="検索条件" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              <SelectItem value="tokyo">東京</SelectItem>
              <SelectItem value="osaka">大阪</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            条件を追加
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-2">
                  <Checkbox />
                </th>
                <th className="text-left py-3 px-4">企業ID</th>
                <th className="text-left py-3 px-4">顧客名</th>
                <th className="text-left py-3 px-4">住所</th>
                <th className="text-left py-3 px-4">URL</th>
                <th className="text-left py-3 px-4">電話番号</th>
                <th className="text-left py-3 px-4">最終コール日</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((company, index) => (
                <tr key={index} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-2">
                    <Checkbox 
                      checked={selectedCompanies.includes(company.id)}
                      onCheckedChange={() => toggleCompanySelection(company.id)}
                    />
                  </td>
                  <td className="py-3 px-4">{company.id}</td>
                  <td className="py-3 px-4">{company.name}</td>
                  <td className="py-3 px-4">{company.address}</td>
                  <td className="py-3 px-4">{company.url}</td>
                  <td className="py-3 px-4">{company.phone}</td>
                  <td className="py-3 px-4">{company.lastCall}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-center mt-6">
          <Button variant="outline" className="flex items-center gap-2">
            <ChevronLeft className="w-4 h-4" />
            前へ
          </Button>
          <span className="text-sm text-gray-500">1-6件（全○件）</span>
          <Button variant="outline" className="flex items-center gap-2">
            次へ
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
