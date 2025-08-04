"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Search, ChevronLeft, ChevronRight } from "lucide-react"
import { Sidebar } from "@/components/sidebar"

const callHistory = [
  {
    id: 1,
    customer: "顧客名1",
    date: "2025/03/01",
    time: "10:30",
    duration: "5分",
    result: "成功",
    notes: "商品に興味あり",
  },
  {
    id: 2,
    customer: "顧客名2",
    date: "2025/03/02",
    time: "14:15",
    duration: "3分",
    result: "不在",
    notes: "留守番電話",
  },
  {
    id: 3,
    customer: "顧客名3",
    date: "2025/03/03",
    time: "16:45",
    duration: "8分",
    result: "要フォロー",
    notes: "検討中",
  },
]

const statusColors = {
  成功: "bg-green-500",
  不在: "bg-yellow-500",
  要フォロー: "bg-purple-500",
  拒否: "bg-red-500",
}

export default function CallHistoryPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedStatus, setSelectedStatus] = useState("")

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1 p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">コール履歴</h1>
          <Button className="bg-orange-500 hover:bg-orange-600">新規コール記録</Button>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b flex gap-4 items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="顧客検索"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="結果" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="success">成功</SelectItem>
                <SelectItem value="absent">不在</SelectItem>
                <SelectItem value="follow">要フォロー</SelectItem>
                <SelectItem value="reject">拒否</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 text-left">
                    <Checkbox />
                  </th>
                  <th className="p-3 text-left">顧客名</th>
                  <th className="p-3 text-left">日付</th>
                  <th className="p-3 text-left">時間</th>
                  <th className="p-3 text-left">通話時間</th>
                  <th className="p-3 text-left">結果</th>
                  <th className="p-3 text-left">メモ</th>
                </tr>
              </thead>
              <tbody>
                {callHistory.map((call) => (
                  <tr key={call.id} className="border-b hover:bg-gray-50">
                    <td className="p-3">
                      <Checkbox />
                    </td>
                    <td className="p-3">{call.customer}</td>
                    <td className="p-3">{call.date}</td>
                    <td className="p-3">{call.time}</td>
                    <td className="p-3">{call.duration}</td>
                    <td className="p-3">
                      <Badge className={`${statusColors[call.result as keyof typeof statusColors]} text-white`}>
                        {call.result}
                      </Badge>
                    </td>
                    <td className="p-3">{call.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-4 flex justify-between items-center border-t">
            <Button variant="outline" size="sm">
              <ChevronLeft className="h-4 w-4 mr-1" />
              前へ
            </Button>
            <span className="text-sm text-gray-600">1-3件 (全3件)</span>
            <Button variant="outline" size="sm">
              次へ
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
