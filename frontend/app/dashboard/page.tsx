"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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
import { Search, ChevronLeft, ChevronRight, Upload, FileUp, X, Phone } from "lucide-react";
import Link from "next/link";
import { Sidebar } from "@/components/sidebar";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { parseCSV, formatCustomerForImport } from "@/lib/csvParser";

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
  phone?: string;
  email?: string;
  company?: string;
  url?: string;
};

const statusColors = {
  不在: "bg-yellow-500",
  成功: "bg-green-500",
  要フォロー: "bg-purple-500",
  拒否: "bg-red-500",
};

export default function DashboardPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPrefecture, setSelectedPrefecture] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [csvPreviewData, setCsvPreviewData] = useState<any[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
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

  // Handle CSV file selection
  const handleFileSelection = useCallback(async (file: File) => {
    // More lenient CSV file check
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: "エラー",
        description: "CSVファイルを選択してください",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);
    
    try {
      // Read and preview CSV data
      const text = await file.text();
      const parsedData = parseCSV(text);
      
      if (parsedData.length === 0) {
        toast({
          title: "エラー",
          description: "CSVファイルが空です",
          variant: "destructive",
        });
        setSelectedFile(null);
        return;
      }
      
      setCsvPreviewData(parsedData.slice(0, 5)); // Preview first 5 rows
      setIsDialogOpen(true);
    } catch (error) {
      toast({
        title: "エラー",
        description: "CSVファイルの読み込みに失敗しました",
        variant: "destructive",
      });
      setSelectedFile(null);
    }
  }, [toast]);

  // Handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelection(e.target.files[0]);
    }
  };

  // Drag & Drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if we're actually leaving the drop zone
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      // Accept CSV files even if MIME type is not set
      if (file.name.toLowerCase().endsWith('.csv')) {
        handleFileSelection(file);
      } else {
        toast({
          title: "エラー",
          description: "CSVファイルのみアップロード可能です",
          variant: "destructive",
        });
      }
    }
  }, [handleFileSelection, toast]);

  const handleImport = async () => {
    if (!selectedFile) return;

    setIsImporting(true);
    
    try {
      // Read CSV file
      const text = await selectedFile.text();
      const parsedData = parseCSV(text);
      
      // Format data for import
      const formattedData = parsedData.map(formatCustomerForImport);
      
      // Send to API
      const response = await fetch("/api/customers/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ customers: formattedData }),
      });

      if (!response.ok) throw new Error("Import failed");

      const result = await response.json();
      toast({
        title: "Success",
        description: `Imported ${formattedData.length} customers`,
      });

      // Refresh customer list
      const refreshResponse = await fetch("/api/customers");
      const data = await refreshResponse.json();
      setCustomers(data);
      
      // Close dialog and reset completely
      setIsDialogOpen(false);
      setSelectedFile(null);
      setCsvPreviewData([]);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to import customers",
        variant: "destructive",
      });
      // Reset on error but keep dialog open for retry
      setSelectedFile(null);
      setCsvPreviewData([]);
    } finally {
      setIsImporting(false);
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

  // Handle select all checkbox
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedCustomers(new Set());
    } else {
      const allIds = new Set(filteredCustomers.map(c => c._id || c.id.toString()));
      setSelectedCustomers(allIds);
    }
    setSelectAll(!selectAll);
  };

  // Handle individual customer selection
  const handleSelectCustomer = (customerId: string) => {
    const newSelected = new Set(selectedCustomers);
    if (newSelected.has(customerId)) {
      newSelected.delete(customerId);
    } else {
      newSelected.add(customerId);
    }
    setSelectedCustomers(newSelected);
    setSelectAll(newSelected.size === filteredCustomers.length && filteredCustomers.length > 0);
  };

  // Handle bulk call
  const handleBulkCall = async () => {
    const selectedCustomerData = customers.filter(c => 
      selectedCustomers.has(c._id || c.id.toString())
    );
    
    const phoneNumbers = selectedCustomerData
      .map(c => c.phone)
      .filter(phone => phone);
    
    const customerIds = selectedCustomerData
      .map(c => c._id || c.id.toString());
    
    if (phoneNumbers.length === 0) {
      toast({
        title: "エラー",
        description: "選択された顧客に電話番号がありません",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch('/api/calls/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          phoneNumbers,
          customerIds 
        })
      });

      if (!response.ok) {
        throw new Error('Failed to initiate bulk calls');
      }

      const result = await response.json();
      
      toast({
        title: "一斉コール開始",
        description: `${phoneNumbers.length}件の顧客に電話をかけています...`,
      });
      
      // Clear selection after starting calls
      setSelectedCustomers(new Set());
      setSelectAll(false);
      
      // Redirect to call monitor page
      router.push('/call-monitor');
      
    } catch (error) {
      toast({
        title: "エラー",
        description: "一斉コールの開始に失敗しました",
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
      !selectedPrefecture || selectedPrefecture === 'all' ||
      (customer.address && customer.address.includes(selectedPrefecture));
    const matchesStatus =
      !selectedStatus || selectedStatus === 'all' || 
      customer.callResult === selectedStatus || 
      customer.result === selectedStatus;

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

      <main 
        className="flex-1 p-6 relative" 
        onDragEnter={handleDragEnter}
      >
        {/* Drag & Drop Overlay */}
        {isDragging && (
          <div 
            className="fixed inset-0 z-50"
            onDragEnter={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.dataTransfer.dropEffect = 'copy';
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (e.currentTarget === e.target) {
                setIsDragging(false);
              }
            }}
            onDrop={handleDrop}
          >
            <div className="absolute inset-0 bg-black/50 pointer-events-none" />
            <div className="flex items-center justify-center h-full pointer-events-none">
              <div className="bg-white rounded-lg p-8 shadow-xl">
                <FileUp className="h-16 w-16 mx-auto mb-4 text-orange-500 animate-bounce" />
                <p className="text-xl font-semibold">CSVファイルをここにドロップ</p>
                <p className="text-sm text-gray-500 mt-2">ファイルを離してアップロード</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">顧客リスト</h1>
          <div className="flex gap-2">
            {selectedCustomers.size > 0 && (
              <Button
                onClick={handleBulkCall}
                className="bg-green-500 hover:bg-green-600 text-white"
              >
                一斉コール ({selectedCustomers.size}件)
              </Button>
            )}
            <Button
              variant="outline"
              className="border-orange-500 text-orange-500 bg-transparent"
              onClick={() => setIsDialogOpen(true)}
            >
              <Upload className="mr-2 h-4 w-4" />
              インポート
            </Button>
            
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogContent className="max-w-3xl">
                <DialogHeader>
                  <DialogTitle>CSVインポート</DialogTitle>
                  <DialogDescription>
                    CSVファイルをドラッグ&ドロップまたは選択してインポートしてください
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {!selectedFile ? (
                    <div 
                      className="border-2 border-dashed rounded-lg p-8 text-center transition-colors border-gray-300 hover:border-gray-400"
                      onDragEnter={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        e.dataTransfer.dropEffect = 'copy';
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const files = e.dataTransfer.files;
                        if (files && files.length > 0) {
                          const file = files[0];
                          if (file.name.toLowerCase().endsWith('.csv')) {
                            handleFileSelection(file);
                          } else {
                            toast({
                              title: "エラー",
                              description: "CSVファイルのみアップロード可能です",
                              variant: "destructive",
                            });
                          }
                        }
                      }}
                    >
                      <FileUp className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                      <p className="text-lg mb-2">CSVファイルをドラッグ&ドロップ</p>
                      <p className="text-sm text-gray-500 mb-4">または</p>
                      <label htmlFor="csv-upload" className="cursor-pointer">
                        <Input
                          type="file"
                          accept=".csv"
                          onChange={handleFileChange}
                          className="hidden"
                          id="csv-upload"
                        />
                        <div className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">
                          ファイルを選択
                        </div>
                      </label>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <span className="text-sm font-medium">{selectedFile.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedFile(null);
                            setCsvPreviewData([]);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      {csvPreviewData.length > 0 && (
                        <div>
                          <p className="text-sm font-medium mb-2">プレビュー (最初の5行):</p>
                          <div className="border rounded overflow-x-auto">
                            <table className="text-sm w-full">
                              <thead className="bg-gray-50">
                                <tr>
                                  {Object.keys(csvPreviewData[0]).map((key) => (
                                    <th key={key} className="p-2 text-left border-b">
                                      {key}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {csvPreviewData.map((row, index) => (
                                  <tr key={index} className="border-b">
                                    {Object.values(row).map((value: any, i) => (
                                      <td key={i} className="p-2">
                                        {value || '-'}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                      
                      <Button
                        onClick={handleImport}
                        disabled={isImporting}
                        className="w-full bg-orange-500 hover:bg-orange-600"
                      >
                        {isImporting ? "インポート中..." : `${csvPreviewData.length}件のデータをインポート`}
                      </Button>
                    </div>
                  )}
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
                <SelectItem value="all">すべて</SelectItem>
                <SelectItem value="北海道">北海道</SelectItem>
                <SelectItem value="青森県">青森県</SelectItem>
                <SelectItem value="岩手県">岩手県</SelectItem>
                <SelectItem value="宮城県">宮城県</SelectItem>
                <SelectItem value="秋田県">秋田県</SelectItem>
                <SelectItem value="山形県">山形県</SelectItem>
                <SelectItem value="福島県">福島県</SelectItem>
                <SelectItem value="茨城県">茨城県</SelectItem>
                <SelectItem value="栃木県">栃木県</SelectItem>
                <SelectItem value="群馬県">群馬県</SelectItem>
                <SelectItem value="埼玉県">埼玉県</SelectItem>
                <SelectItem value="千葉県">千葉県</SelectItem>
                <SelectItem value="東京都">東京都</SelectItem>
                <SelectItem value="神奈川県">神奈川県</SelectItem>
                <SelectItem value="新潟県">新潟県</SelectItem>
                <SelectItem value="富山県">富山県</SelectItem>
                <SelectItem value="石川県">石川県</SelectItem>
                <SelectItem value="福井県">福井県</SelectItem>
                <SelectItem value="山梨県">山梨県</SelectItem>
                <SelectItem value="長野県">長野県</SelectItem>
                <SelectItem value="岐阜県">岐阜県</SelectItem>
                <SelectItem value="静岡県">静岡県</SelectItem>
                <SelectItem value="愛知県">愛知県</SelectItem>
                <SelectItem value="三重県">三重県</SelectItem>
                <SelectItem value="滋賀県">滋賀県</SelectItem>
                <SelectItem value="京都府">京都府</SelectItem>
                <SelectItem value="大阪府">大阪府</SelectItem>
                <SelectItem value="兵庫県">兵庫県</SelectItem>
                <SelectItem value="奈良県">奈良県</SelectItem>
                <SelectItem value="和歌山県">和歌山県</SelectItem>
                <SelectItem value="鳥取県">鳥取県</SelectItem>
                <SelectItem value="島根県">島根県</SelectItem>
                <SelectItem value="岡山県">岡山県</SelectItem>
                <SelectItem value="広島県">広島県</SelectItem>
                <SelectItem value="山口県">山口県</SelectItem>
                <SelectItem value="徳島県">徳島県</SelectItem>
                <SelectItem value="香川県">香川県</SelectItem>
                <SelectItem value="愛媛県">愛媛県</SelectItem>
                <SelectItem value="高知県">高知県</SelectItem>
                <SelectItem value="福岡県">福岡県</SelectItem>
                <SelectItem value="佐賀県">佐賀県</SelectItem>
                <SelectItem value="長崎県">長崎県</SelectItem>
                <SelectItem value="熊本県">熊本県</SelectItem>
                <SelectItem value="大分県">大分県</SelectItem>
                <SelectItem value="宮崎県">宮崎県</SelectItem>
                <SelectItem value="鹿児島県">鹿児島県</SelectItem>
                <SelectItem value="沖縄県">沖縄県</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="ステータス" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">すべて</SelectItem>
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
                    <Checkbox 
                      checked={selectAll}
                      onCheckedChange={handleSelectAll}
                    />
                  </th>
                  <th className="p-3 text-left">番号</th>
                  <th className="p-3 text-left">顧客名</th>
                  <th className="p-3 text-left">住所</th>
                  <th className="p-3 text-left">URL</th>
                  <th className="p-3 text-left">電話番号</th>
                  <th className="p-3 text-left">最終コール日</th>
                  <th className="p-3 text-left">ステータス</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((customer, index) => {
                  const customerId = customer._id || customer.id.toString();
                  return (
                    <tr key={customerId} className="border-b hover:bg-gray-50">
                      <td className="p-3">
                        <Checkbox 
                          checked={selectedCustomers.has(customerId)}
                          onCheckedChange={() => handleSelectCustomer(customerId)}
                        />
                      </td>
                      <td className="p-3">{index + 1}</td>
                      <td className="p-3">
                        <button
                          onClick={() => router.push(`/customer/${customerId}`)}
                          className="text-blue-600 hover:underline text-left w-full"
                        >
                          {customer.customer || `顧客名${index + 1}`}
                        </button>
                      </td>
                      <td className="p-3">{customer.address || `住所${index + 1}`}</td>
                      <td className="p-3">
                        {customer.company ? (
                          <a href="#" className="text-blue-600 hover:underline">
                            URL{index + 1}
                          </a>
                        ) : (
                          `URL${index + 1}`
                        )}
                      </td>
                      <td className="p-3">{customer.phone || `電話番号${index + 1}`}</td>
                      <td className="p-3">{customer.date || '2025/03/01'}</td>
                      <td className="p-3">
                        <Badge
                          className={`${
                            statusColors[
                              customer.result as keyof typeof statusColors
                            ] || "bg-gray-500"
                          } text-white`}
                        >
                          {customer.result || customer.callResult || "不在"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
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
