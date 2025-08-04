"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, ChevronLeft, ChevronRight, Upload } from "lucide-react";
import Link from "next/link";
import { Sidebar } from "@/components/sidebar";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import AICallButton from "@/components/ai -call-button";

// Define customer type
type Customer = {
  id: number;
  _id?: string;
  name: string;
  address: string;
  status: string;
  lastCall: string;
  callResult: string;
  date?: string;
  time?: string;
  duration?: string;
  result?: string;
  customer?: string;
  notes?: string;
};

const statusColors = {
  不在: "bg-yellow-500",
  成功: "bg-green-500",
  要フォロー: "bg-purple-500",
  拒否: "bg-red-500",
};

export default function DashboardPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPrefecture, setSelectedPrefecture] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const { toast } = useToast();

  // Fetch customers from API
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const response = await fetch("/api/customers");
        if (!response.ok) throw new Error("Failed to fetch customers");
        const data = await response.json();
        setCustomers(data);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to fetch customers",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchCustomers();
  }, [toast]);

  // Handle CSV import
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    setIsImporting(true);
    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch("/api/customers/import", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Import failed");

      const result = await response.json();
      toast({
        title: "Success",
        description: `Imported ${result.count} customers`,
      });

      // Refresh customer list
      const refreshResponse = await fetch("/api/customers");
      const data = await refreshResponse.json();
      setCustomers(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to import customers",
        variant: "destructive",
      });
    } finally {
      debugger;
      setIsImporting(false);
      setSelectedFile(null);
    }
  };

  // Delete selected customers
  const deleteSelectedCustomers = async (ids: number[]) => {
    try {
      const response = await fetch("/api/customers", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids }),
      });

      if (!response.ok) throw new Error("Deletion failed");

      toast({
        title: "Success",
        description: "Deleted selected customers",
      });

      // Refresh customer list
      const refreshResponse = await fetch("/api/customers");
      const data = await refreshResponse.json();
      setCustomers(data);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete customers",
        variant: "destructive",
      });
    }
  };

  // Filter customers based on search and filters
  const filteredCustomers = customers.filter((customer) => {
    const matchesSearch =
      (customer.customer &&
        customer.customer.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (customer.address &&
        customer.address.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesPrefecture =
      !selectedPrefecture ||
      (customer.address && customer.address.includes(selectedPrefecture));
    const matchesStatus =
      !selectedStatus || customer.callResult === selectedStatus;

    return matchesSearch && matchesPrefecture && matchesStatus;
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 p-6 flex items-center justify-center">
          <div>Loading...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1 p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">顧客リスト</h1>
          <div className="flex gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="border-orange-500 text-orange-500 bg-transparent"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  インポート
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>CSVインポート</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid gap-2">
                    <Input
                      type="file"
                      accept=".csv"
                      onChange={handleFileChange}
                      disabled={isImporting}
                    />
                    <p className="text-sm text-muted-foreground">
                      CSVファイルを選択してください。形式:
                      customer,date,time,duration,result,notes,address
                    </p>
                  </div>
                  <Button
                    onClick={handleImport}
                    disabled={!selectedFile || isImporting}
                    className="bg-orange-500 hover:bg-orange-600"
                  >
                    {isImporting ? "インポート中..." : "インポート"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Link href="/customer/new">
              <Button className="bg-orange-500 hover:bg-orange-600">
                新規登録
              </Button>
            </Link>
          </div>
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

            <Select
              value={selectedPrefecture}
              onValueChange={setSelectedPrefecture}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="都道府県" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="東京都">東京都</SelectItem>
                <SelectItem value="千葉県">千葉県</SelectItem>
                <SelectItem value="神奈川県">神奈川県</SelectItem>
                <SelectItem value="埼玉県">埼玉県</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="ステータス" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="不在">不在</SelectItem>
                <SelectItem value="成功">成功</SelectItem>
                <SelectItem value="要フォロー">要フォロー</SelectItem>
                <SelectItem value="拒否">拒否</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline">+ 条件を追加</Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-3 text-left">
                    <Checkbox />
                  </th>
                  <th className="p-3 text-left">顧客名</th>
                  <th className="p-3 text-left">住所</th>
                  <th className="p-3 text-left">日付</th>
                  <th className="p-3 text-left">時間</th>
                  <th className="p-3 text-left">期間</th>
                  <th className="p-3 text-left">ステータス</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((customer) => (
                  <tr key={customer._id} className="border-b hover:bg-gray-50">
                    <td className="p-3">
                      <Checkbox />
                    </td>
                    <td className="p-3">
                      <Link
                        href={`/customer/${customer._id}`}
                        className="text-orange-500 hover:underline"
                      >
                        {customer.customer}
                      </Link>
                    </td>
                    <td className="p-3">{customer.address || "-"}</td>
                    <td className="p-3">{customer.date}</td>
                    <td className="p-3">{customer.time}</td>
                    <td className="p-3">{customer.duration}</td>
                    <td className="p-3">
                      <Badge
                        className={`${
                          statusColors[
                            customer.result as keyof typeof statusColors
                          ] || "bg-gray-500"
                        } text-white`}
                      >
                        {customer.callResult}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <AICallButton />
                    </td>
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
            <span className="text-sm text-gray-600">
              {filteredCustomers.length > 0
                ? `1-${filteredCustomers.length}件 (全${filteredCustomers.length}件)`
                : "0件"}
            </span>
            <Button variant="outline" size="sm">
              次へ
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
