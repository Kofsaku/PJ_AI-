"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, FileText, Download } from "lucide-react"
import { Sidebar } from "@/components/sidebar"

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0])
      setError(null)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setError(null)
    }
  }

  const handleDownloadSample = () => {
    const sample = `customer,email,phone,address,company,result,notes,url
山田太郎,yamada@example.com,090-1234-5678,東京都渋谷区1-2-3,株式会社サンプル,未対応,サンプルデータ,https://example.com`

    // UTF-8 BOMを追加してExcelでも正しく表示されるようにする
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF])
    const blob = new Blob([bom, sample], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)

    link.setAttribute('href', url)
    link.setAttribute('download', 'customer_sample.csv')
    link.style.visibility = 'hidden'

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const parseCSV = (text: string): any[] => {
    console.log('[CSV Parse] Raw text length:', text.length)
    const lines = text.split('\n').filter(line => line.trim())
    console.log('[CSV Parse] Lines found:', lines.length)

    if (lines.length < 2) return []

    const headers = lines[0].split(',').map(h => h.trim())
    console.log('[CSV Parse] Headers:', headers)
    const customers = []

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim())
      if (values.length >= headers.length) {
        const customer: any = {}
        headers.forEach((header, index) => {
          customer[header] = values[index] || ''
        })
        customers.push(customer)

        if (i === 1) {
          console.log('[CSV Parse] First customer sample:')
          console.log('Raw line:', lines[i])
          console.log('Parsed values:', values)
          console.log('Customer object:', customer)
          console.log('Result field value:', customer.result)
        }
      }
    }

    console.log('[CSV Parse] Total customers parsed:', customers.length)
    return customers
  }

  const handleImport = async () => {
    if (!file) return
    
    setLoading(true)
    setError(null)
    
    try {
      const text = await file.text()
      const customers = parseCSV(text)
      
      if (customers.length === 0) {
        setError('CSVファイルにデータが見つかりません')
        setLoading(false)
        return
      }

      console.log('[Import API] Sending data to API:', customers)
      console.log('[Import API] First customer being sent:', customers[0])

      const token = localStorage.getItem('token')
      const response = await fetch('/api/customers/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ customers })
      })

      console.log('[Import API] Response status:', response.status)

      if (!response.ok) {
        const errorData = await response.json()
        const errorMessage = errorData.error || errorData.message || 'インポートに失敗しました'
        throw new Error(errorMessage)
      }

      const result = await response.json()
      console.log('Import successful:', result)
      
      // Store the import result in localStorage for the complete page
      localStorage.setItem('importResult', JSON.stringify({
        totalImported: customers.length,
        message: result.message,
        timestamp: new Date().toISOString()
      }))
      
      router.push("/import/complete")
    } catch (err) {
      console.error('Import error:', err)
      setError(err instanceof Error ? err.message : 'インポート中にエラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />

      <main className="ml-64 p-6">
        <h1 className="text-2xl font-bold mb-6">顧客情報インポート</h1>

        <Card>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 m-6 mb-0">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}
            <CardHeader>
              <CardTitle>ファイルを選択してください</CardTitle>
              <p className="text-sm text-gray-600">CSVファイルをドラッグ&ドロップするか、ファイルを選択してください</p>
            </CardHeader>
            <CardContent className="space-y-4">

              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragActive ? "border-orange-500 bg-orange-50" : "border-gray-300 hover:border-gray-400"
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                {file ? (
                  <div className="space-y-2">
                    <FileText className="h-12 w-12 text-green-500 mx-auto" />
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Upload className="h-12 w-12 text-gray-400 mx-auto" />
                    <p className="text-gray-600">ファイルをここにドラッグ&ドロップ</p>
                    <p className="text-sm text-gray-500">または</p>
                    <label htmlFor="file-upload" className="inline-block cursor-pointer">
                      <Input id="file-upload" type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
                      <Button type="button" variant="outline" className="pointer-events-none">
                        ファイルを選択
                      </Button>
                    </label>
                  </div>
                )}
              </div>

              <div className="flex justify-start">
                <Button
                  variant="outline"
                  onClick={handleDownloadSample}
                  className="border-blue-500 text-blue-600 hover:bg-blue-50"
                >
                  <Download className="mr-2 h-4 w-4" />
                  サンプルCSVをダウンロード
                </Button>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-medium text-blue-900 mb-2">CSVファイル形式について</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• 1行目はヘッダー行として扱われます</li>
                  <li>• 文字コードはUTF-8で保存してください</li>
                  <li>• 必須項目: customer, phone</li>
                  <li>• 最大10,000件まで一度にインポート可能です</li>
                </ul>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => {
                  setFile(null)
                  setError(null)
                }} disabled={loading}>
                  キャンセル
                </Button>
                <Button 
                  onClick={handleImport} 
                  disabled={!file || loading} 
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  {loading ? 'インポート中...' : 'インポート実行'}
                </Button>
              </div>
            </CardContent>
          </Card>
      </main>
    </div>
  )
}
