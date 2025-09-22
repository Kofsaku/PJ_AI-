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
import { Search, ChevronLeft, ChevronRight, Upload, FileUp, X, Phone, Loader2 } from "lucide-react";
import Link from "next/link";
import { Sidebar } from "@/components/sidebar";
import { useToast } from "@/components/ui/use-toast";
import { authenticatedApiRequest, getApiUrl } from "@/lib/apiHelper";
import { parseCSV, formatCustomerForImport } from "@/lib/csvParser";
import { normalizeApiResponse, getCustomerId, getCustomerIds } from "@/lib/utils/id-normalizer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { CallModal } from "@/components/calls/CallModal";
import { CallStatusModal } from "@/components/calls/CallStatusModal";

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

// 定義されているステータス値
const VALID_CALL_RESULTS = ['成功', '不在', '拒否', '要フォロー', '失敗', '通話中', '未対応', '競合比較中', '見積依頼', '資料請求', '導入検討'];

const statusColors = {
  不在: "bg-yellow-500",
  成功: "bg-green-500",
  要フォロー: "bg-purple-500",
  拒否: "bg-red-500",
  失敗: "bg-gray-500",
  通話中: "bg-blue-500",
  未対応: "bg-gray-600",
  未設定: "bg-gray-400",
  競合比較中: "bg-orange-500",
  見積依頼: "bg-cyan-500",
  資料請求: "bg-indigo-500",
  導入検討: "bg-emerald-500"
};

// ステータス値を正規化する関数
const normalizeStatus = (status: string | null | undefined): string => {
  if (!status) return "未設定";
  if (VALID_CALL_RESULTS.includes(status)) return status;
  console.warn(`[Dashboard] Invalid status detected: ${status}, using "未設定"`);
  return "未設定";
};

export default function DashboardPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPrefecture, setSelectedPrefecture] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [isCallDialogOpen, setIsCallDialogOpen] = useState(false);
  const [callProgress, setCallProgress] = useState(0);
  const [callResults, setCallResults] = useState<any[]>([]);
  const [isCalling, setIsCalling] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null);
  const [activeCallModal, setActiveCallModal] = useState<{
    isOpen: boolean;
    customerName: string;
    phoneNumber: string;
    customerId: string;
  }>({ isOpen: false, customerName: "", phoneNumber: "", customerId: "" });
  const [isCallStatusModalOpen, setIsCallStatusModalOpen] = useState(false);
  const [activePhoneNumber, setActivePhoneNumber] = useState("");
  const [callingSessions, setCallingSessions] = useState<Set<string>>(new Set()); // 通話中の顧客ID
  const [phoneToCustomerMap, setPhoneToCustomerMap] = useState<Map<string, string>>(new Map()); // phone -> customerId
  const [isBulkCallActive, setIsBulkCallActive] = useState(false); // 一斉通話実行中フラグ
  const [bulkCallQueue, setBulkCallQueue] = useState<number>(0); // キュー中の通話数
  const { toast } = useToast();

  // Fetch customers from API
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const data = await authenticatedApiRequest('/api/customers');
        setCustomers(normalizeApiResponse(data));
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

    setIsImporting(true);
    
    try {
      // Read and parse CSV data
      const text = await file.text();
      const parsedData = parseCSV(text);
      
      if (parsedData.length === 0) {
        toast({
          title: "エラー",
          description: "CSVファイルが空です",
          variant: "destructive",
        });
        setIsImporting(false);
        return;
      }
      
      // Format data for import
      const formattedData = parsedData.map(formatCustomerForImport);
      
      // Send to API directly without showing dialog
      const token = localStorage.getItem('token');
      const response = await fetch("/api/customers/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ customers: formattedData }),
      });

      if (!response.ok) throw new Error("Import failed");

      const result = await response.json();
      toast({
        title: "成功",
        description: `${formattedData.length}件のデータをインポートしました`,
      });

      // Refresh customer list
      const data = await authenticatedApiRequest('/api/customers');
      setCustomers(normalizeApiResponse(data));
      
    } catch (error) {
      toast({
        title: "エラー",
        description: "CSVファイルのインポートに失敗しました",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
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

  // Removed old handleImport function - now handled directly in handleFileSelection

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
      const data = await authenticatedApiRequest('/api/customers');
      setCustomers(normalizeApiResponse(data));
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
      const allIds = new Set(getCustomerIds(filteredCustomers));
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

  // Handle status change
  const handleStatusChange = async (customerId: string, newStatus: string) => {
    if (isUpdatingStatus === customerId) return; // 重複更新を防ぐ
    
    setIsUpdatingStatus(customerId);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/customers?id=${customerId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          result: newStatus,
          callResult: newStatus 
        }),
      });

      if (!response.ok) throw new Error('Failed to update status');

      // Update local state
      setCustomers(prevCustomers => 
        prevCustomers.map(c => 
          getCustomerId(c) === customerId 
            ? { ...c, result: newStatus, callResult: newStatus }
            : c
        )
      );

      toast({
        title: "ステータス更新",
        description: `ステータスを「${newStatus}」に変更しました`,
      });
    } catch (error) {
      console.error('Status update error:', error);
      toast({
        title: "エラー",
        description: "ステータスの更新に失敗しました",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingStatus(null);
    }
  };

  // Handle bulk call
  const handleBulkCall = async () => {
    const selectedCustomerData = customers.filter(c => 
      selectedCustomers.has(getCustomerId(c))
    );
    
    const phoneNumbers = selectedCustomerData
      .map(c => c.phone)
      .filter(phone => phone);
    
    const customerIds = selectedCustomerData
      .map(getCustomerId);
    
    if (phoneNumbers.length === 0) {
      toast({
        title: "エラー",
        description: "選択された顧客に電話番号がありません",
        variant: "destructive",
      });
      return;
    }

    // Don't open the progress dialog, go directly to call status modal
    setIsCalling(true);
    setCallProgress(0);
    setCallResults([]);

    try {
      // 電話番号と顧客IDのマッピングを作成（通話状態はポーリングで管理）
      const phoneMap = new Map<string, string>();
      phoneNumbers.forEach((phone, index) => {
        if (customerIds[index]) {
          phoneMap.set(phone, customerIds[index]);
        }
      });
      setPhoneToCustomerMap(phoneMap);
      
      // 通話中状態はクリアして、実際の通話開始時にポーリングで検出される
      setCallingSessions(new Set());
      
      // Immediately open the call status modal
      if (phoneNumbers.length > 0) {
        console.log("[Dashboard] 一斉コール開始, 電話番号:", phoneNumbers[0]);
        setActivePhoneNumber(phoneNumbers[0]);
        setIsCallStatusModalOpen(true);
      }

      const result = await authenticatedApiRequest('/api/calls/bulk', {
        method: 'POST',
        body: JSON.stringify({ 
          phoneNumbers,
          customerIds 
        })
      });
      
      // Update progress and results - 修正: result.results を result.sessions に変更
      setCallProgress(100);
      setCallResults(result.sessions || []);
      setIsCalling(false);

      toast({
        title: "一斉コール開始",
        description: `${phoneNumbers.length}件の電話を開始しました`,
      });

      // Clear selection after starting calls
      setSelectedCustomers(new Set());
      setSelectAll(false);

      // ポーリングで通話状態を監視するため、ここではクリアしない
      // 実際の通話終了イベントでクリアされる

    } catch (error) {
      setIsCalling(false);
      setCallingSessions(new Set()); // エラー時も通話中状態をクリア
      toast({
        title: "エラー",
        description: "一斉コールの開始に失敗しました",
        variant: "destructive",
      });
    }
  };


  // ポーリングベースのリアルタイム通話状態更新
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    console.log("[Dashboard] Starting polling for call status updates");

    // 通話状態を取得する関数
    const fetchCallStatuses = async () => {
      try {
        const data = await authenticatedApiRequest('/api/calls/bulk');
        if (!data.success || !data.sessions) return;

        // アクティブな通話セッションを特定
        const newCallingSessions = new Set<string>();
        let activeCallCount = 0;
        let queuedCallCount = 0;

        data.sessions.forEach((session: any) => {
          const phoneNumber = session.phoneNumber?.startsWith('+81')
            ? '0' + session.phoneNumber.substring(3)
            : session.phoneNumber;

          let customerId = session.customer?._id || session.customer;
          if (!customerId) {
            const customer = customers.find(c => c.phone === phoneNumber);
            if (customer) {
              customerId = getCustomerId(customer);
            }
          }

          if (customerId) {
            // アクティブな通話状態をチェック
            if (['calling', 'initiated', 'ai-responding', 'in-progress', 'human-connected', 'transferring'].includes(session.status)) {
              newCallingSessions.add(customerId);
              activeCallCount++;
            } else if (session.status === 'queued') {
              queuedCallCount++;
            }

            // 通話結果が更新されていれば顧客リストに反映
            if (session.callResult) {
              setCustomers(prev =>
                prev.map(c =>
                  getCustomerId(c) === customerId
                    ? { ...c, result: session.callResult, callResult: session.callResult }
                    : c
                )
              );
            }
          }
        });

        // 通話中セッションを更新
        setCallingSessions(prev => {
          const hasChanges = prev.size !== newCallingSessions.size ||
            [...prev].some(id => !newCallingSessions.has(id));
          if (hasChanges) {
            console.log('[Dashboard] Updated calling sessions:', newCallingSessions);
            return newCallingSessions;
          }
          return prev;
        });

        // バルクコール状態を更新
        const totalActiveCalls = activeCallCount + queuedCallCount;
        if (totalActiveCalls > 0) {
          setIsBulkCallActive(true);
          setBulkCallQueue(queuedCallCount);
        } else if (isBulkCallActive && newCallingSessions.size === 0) {
          setIsBulkCallActive(false);
          setBulkCallQueue(0);
        }

      } catch (error) {
        console.error('[Dashboard] Error polling call statuses:', error);
      }
    };

    // 初回実行
    fetchCallStatuses();

    // 3秒間隔でポーリング（通話中の場合は頻度を上げる）
    const pollingInterval = setInterval(() => {
      if (isBulkCallActive || callingSessions.size > 0) {
        fetchCallStatuses();
      }
    }, 3000);

    // 通話状態が非アクティブの場合は低頻度ポーリング
    const lowFrequencyInterval = setInterval(() => {
      if (!isBulkCallActive && callingSessions.size === 0) {
        fetchCallStatuses();
      }
    }, 10000);

    return () => {
      clearInterval(pollingInterval);
      clearInterval(lowFrequencyInterval);
      console.log('[Dashboard] Stopped polling for call status updates');
    };
  }, [customers, isBulkCallActive, callingSessions.size]);

  // 通話状態監視 - 全通話終了時に一斉通話状態を自動リセット（遅延実行）
  useEffect(() => {
    if (isBulkCallActive && callingSessions.size === 0 && bulkCallQueue === 0) {
      console.log("[Dashboard] All calls ended and queue empty, scheduling bulk call state reset");

      // 3秒後にリセット（通話終了処理の完了を待つ）
      const resetTimer = setTimeout(() => {
        // タイマー実行時にも再度確認してから実行
        if (callingSessions.size === 0 && bulkCallQueue === 0) {
          console.log("[Dashboard] Auto-resetting bulk call state after delay");
          setIsBulkCallActive(false);
          toast({
            title: "通話完了",
            description: "すべての通話が終了しました",
          });
        } else {
          console.log("[Dashboard] Reset cancelled - calls still active");
        }
      }, 3000);

      return () => {
        clearTimeout(resetTimer);
      };
    }
  }, [callingSessions.size, isBulkCallActive, bulkCallQueue, toast]);

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
      <div className="min-h-screen bg-gray-50">
        <Sidebar />
        <main className="ml-64 p-6 flex items-center justify-center">
          <div>Loading...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />

      <main
        className="ml-64 p-6 relative"
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
            
            {/* 停止ボタン - 一斉通話実行中のみ表示 */}
            {isBulkCallActive && (
              <Button
                onClick={async () => {
                  try {
                    await authenticatedApiRequest('/api/calls/bulk/stop', {
                      method: 'POST'
                    });
                    
                    toast({
                        title: "停止処理中",
                        description: "一斉通話を停止しています...",
                      });
                  } catch (error) {
                    toast({
                      title: "エラー",
                      description: "停止処理に失敗しました",
                      variant: "destructive",
                    });
                  }
                }}
                className="bg-red-500 hover:bg-red-600 text-white animate-pulse"
              >
                <X className="mr-2 h-4 w-4" />
                停止 {bulkCallQueue > 0 && `(残り${bulkCallQueue}件)`}
              </Button>
            )}
            
            <label htmlFor="csv-import-btn" className="cursor-pointer">
              <Input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
                id="csv-import-btn"
                disabled={isImporting}
              />
              <Button
                variant="outline"
                className="border-orange-500 text-orange-500 bg-transparent pointer-events-none"
                disabled={isImporting}
              >
                <Upload className="mr-2 h-4 w-4" />
                {isImporting ? "インポート中..." : "インポート"}
              </Button>
            </label>

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
                <SelectItem value="失敗">失敗</SelectItem>
                <SelectItem value="競合比較中">競合比較中</SelectItem>
                <SelectItem value="見積依頼">見積依頼</SelectItem>
                <SelectItem value="資料請求">資料請求</SelectItem>
                <SelectItem value="導入検討">導入検討</SelectItem>
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
                  const customerId = getCustomerId(customer);
                  const isCallingNow = callingSessions.has(customerId);
                  return (
                    <tr 
                      key={customerId} 
                      className={`border-b transition-all ${
                        isCallingNow 
                          ? 'bg-green-50 border-green-200 hover:bg-green-100' 
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="p-3">
                        <Checkbox 
                          checked={selectedCustomers.has(customerId)}
                          onCheckedChange={() => handleSelectCustomer(customerId)}
                        />
                      </td>
                      <td className="p-3">{index + 1}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => router.push(`/customer/${customerId}`)}
                            className="text-blue-600 hover:underline text-left"
                          >
                            {customer.customer || `顧客名${index + 1}`}
                          </button>
                          {isCallingNow && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-green-700 bg-green-100 rounded-full">
                              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                              通話中
                            </span>
                          )}
                        </div>
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
                        {isCallingNow ? (
                          <div className="flex items-center gap-2">
                            <div className="relative">
                              <Phone className="w-4 h-4 text-green-600 animate-pulse" />
                              <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-ping"></div>
                            </div>
                            <Badge
                              className="bg-green-500 text-white cursor-pointer hover:bg-green-600 transition-colors"
                              onClick={() => {
                                console.log("[Dashboard] 通話中バッジクリック, 電話番号:", customer.phone);
                                setActivePhoneNumber(customer.phone || "");
                                setIsCallStatusModalOpen(true);
                              }}
                            >
                              通話中
                            </Badge>
                          </div>
                        ) : (
                          <Select
                            value={normalizeStatus(customer.result || customer.callResult)}
                            onValueChange={(value) => handleStatusChange(customerId, value)}
                          >
                            <SelectTrigger className="w-32 h-8">
                              <SelectValue>
                                {(() => {
                                  const normalizedStatus = normalizeStatus(customer.result || customer.callResult);
                                  return (
                                    <Badge
                                      className={`${statusColors[normalizedStatus]} text-white`}
                                    >
                                      {normalizedStatus}
                                    </Badge>
                                  );
                                })()}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="不在">
                                <Badge className="bg-yellow-500 text-white">不在</Badge>
                              </SelectItem>
                              <SelectItem value="成功">
                                <Badge className="bg-green-500 text-white">成功</Badge>
                              </SelectItem>
                              <SelectItem value="要フォロー">
                                <Badge className="bg-purple-500 text-white">要フォロー</Badge>
                              </SelectItem>
                              <SelectItem value="拒否">
                                <Badge className="bg-red-500 text-white">拒否</Badge>
                              </SelectItem>
                              <SelectItem value="失敗">
                                <Badge className="bg-gray-500 text-white">失敗</Badge>
                              </SelectItem>
                              <SelectItem value="競合比較中">
                                <Badge className="bg-orange-500 text-white">競合比較中</Badge>
                              </SelectItem>
                              <SelectItem value="見積依頼">
                                <Badge className="bg-cyan-500 text-white">見積依頼</Badge>
                              </SelectItem>
                              <SelectItem value="資料請求">
                                <Badge className="bg-indigo-500 text-white">資料請求</Badge>
                              </SelectItem>
                              <SelectItem value="導入検討">
                                <Badge className="bg-emerald-500 text-white">導入検討</Badge>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        )}
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

      {/* Call Modal */}
      <CallModal
        isOpen={activeCallModal.isOpen}
        onClose={() => setActiveCallModal({ ...activeCallModal, isOpen: false })}
        customerName={activeCallModal.customerName}
        phoneNumber={activeCallModal.phoneNumber}
        customerId={activeCallModal.customerId}
      />

      {/* Call Status Modal */}
      <CallStatusModal
        isOpen={isCallStatusModalOpen}
        onClose={() => {
          setIsCallStatusModalOpen(false);
          // モーダルを閉じても通話中状態は維持（実際の通話状態に依存）
        }}
        phoneNumber={activePhoneNumber}
      />
    </div>
  );
}
