"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, FileText } from "lucide-react"
import { Sidebar } from "@/components/sidebar"

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null)
  const [dragActive, setDragActive] = useState(false)
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
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const handleImport = () => {
    if (file) {
      router.push("/import/complete")
    }
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1 p-6">
        <h1 className="text-2xl font-bold mb-6">CSVファイルインポート</h1>

        <div className="max-w-2xl">
          <Card>
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
                  <div className="space-y-2">
                    <Upload className="h-12 w-12 text-gray-400 mx-auto" />
                    <p className="text-gray-600">ファイルをここにドラッグ&ドロップ</p>
                    <p className="text-sm text-gray-500">または</p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="file-upload">ファイルを選択</Label>
                <Input id="file-upload" type="file" accept=".csv" onChange={handleFileChange} />
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-medium text-blue-900 mb-2">CSVファイル形式について</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• 1行目はヘッダー行として扱われます</li>
                  <li>• 文字コードはUTF-8で保存してください</li>
                  <li>• 必須項目: 氏名、メールアドレス</li>
                  <li>• 最大10,000件まで一度にインポート可能です</li>
                </ul>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => router.back()}>
                  キャンセル
                </Button>
                <Button onClick={handleImport} disabled={!file} className="bg-orange-500 hover:bg-orange-600">
                  インポート実行
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
