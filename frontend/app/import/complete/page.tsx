"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, AlertCircle } from "lucide-react"
import Link from "next/link"
import { Sidebar } from "@/components/sidebar"

export default function ImportCompletePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />

      <main className="ml-64 p-6 flex items-center justify-center">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4">
              <CheckCircle className="h-16 w-16 text-green-500" />
            </div>
            <CardTitle className="text-xl">インポート完了</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center justify-center space-x-2 text-green-800">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">成功: 150件</span>
              </div>
            </div>

            <div className="bg-yellow-50 p-4 rounded-lg">
              <div className="flex items-center justify-center space-x-2 text-yellow-800">
                <AlertCircle className="h-5 w-5" />
                <span className="font-medium">スキップ: 5件</span>
              </div>
              <p className="text-sm text-yellow-700 mt-1">重複データのためスキップされました</p>
            </div>

            <Link href="/dashboard">
              <Button className="w-full bg-orange-500 hover:bg-orange-600">顧客一覧を確認</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
