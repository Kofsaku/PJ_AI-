"use client";

import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, UserPlus, Phone, Mic, Volume2, Loader2 } from "lucide-react";
import { io, Socket } from "socket.io-client";

interface CallStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  phoneNumber: string;
}

interface TranscriptEntry {
  speaker: "AI" | "Customer" | "System";
  text: string;
  timestamp: string;
}

export function CallStatusModal({
  isOpen,
  onClose,
  phoneNumber,
}: CallStatusModalProps) {
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [isTransferring, setIsTransferring] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [callStatus, setCallStatus] = useState<"connecting" | "connected" | "ended">("connecting");
  const [callSid, setCallSid] = useState<string | null>(null);
  const [modalOpenTime, setModalOpenTime] = useState<Date | null>(null);
  const [processedMessages, setProcessedMessages] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && phoneNumber) {
      // 新しい通話のためにトランスクリプトをクリア
      const openTime = new Date();
      setModalOpenTime(openTime);
      setTranscript([{
        speaker: "System",
        text: "会話が開始されると、ここに表示されます",
        timestamp: new Date().toLocaleTimeString("ja-JP"),
      }]);
      setCallStatus("connecting");
      setCallSid(null); // CallSidもリセット
      setProcessedMessages(new Set()); // 処理済みメッセージをクリア
      
      // 電話番号を正規化（ハイフンを除去し、0906... 形式に統一）
      const normalizePhoneNumber = (phone: string) => {
        if (!phone) return '';
        // ハイフンとスペースを削除
        let normalized = phone.replace(/[-\s]/g, '');
        // +81を0に変換
        if (normalized.startsWith('+81')) {
          normalized = '0' + normalized.substring(3);
        }
        return normalized;
      };

      const normalizedPhone = normalizePhoneNumber(phoneNumber);
      
      // Initialize socket connection
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001";
      const token = localStorage.getItem('token');

      const newSocket = io(backendUrl, {
        transports: ["websocket"],
        auth: { token }
      });

      newSocket.on("connect", () => {
        // Join room for this specific call
        newSocket.emit("join-call", { phoneNumber: normalizedPhone });
        
        // 接続時に現在の通話状況を要求
        newSocket.emit("get-call-status", { phoneNumber: normalizedPhone });
        
        // 少し遅延してから既存の通話情報を要求
        setTimeout(() => {
          newSocket.emit("get-existing-call-data", { phoneNumber: normalizedPhone });
        }, 500);
      });
      
      // join-call成功確認
      newSocket.on("joined-call-room", (data) => {
        // 接続確認完了
      });

      newSocket.on("connect_error", (error) => {
        console.error("Socket connection error:", error);
        setTranscript((prev) => [
          ...prev,
          {
            speaker: "System",
            text: "バックエンドへの接続に失敗しました。",
            timestamp: new Date().toLocaleTimeString("ja-JP"),
          },
        ]);
        
        // モックデータは表示しない
        // simulateMockConversation();
      });

      // Listen for bulk calls started event
      newSocket.on("bulk-calls-started", (data) => {
        if (data.sessions && Array.isArray(data.sessions)) {
          const session = data.sessions.find((s: any) => {
            const normalizedSessionPhone = s.phoneNumber?.startsWith('+81') 
              ? '0' + s.phoneNumber.substring(3) 
              : s.phoneNumber;
            const normalizedTargetPhone = normalizedPhone;
            return normalizedSessionPhone === normalizedTargetPhone;
          });
          
          if (session) {
            setCallSid(session.twilioCallSid || session.id);
            setCallStatus("connecting");
          }
        }
      });

      // Listen for call status updates
      newSocket.on("call-status", (data) => {
        const normalizedDataPhone = normalizePhoneNumber(data.phoneNumber);
        const normalizedTargetPhone = normalizedPhone;
        
        
        if (normalizedDataPhone === normalizedTargetPhone || data.callSid === callSid || data.callId === callSid) {
          if (data.status === "in-progress" || data.status === "calling" || data.status === "ai-responding" || data.status === "initiated" || data.status === "human-connected") {
            setCallStatus("connected");
            const newCallSid = data.callSid || data.callId || data.twilioCallSid;
            setCallSid(newCallSid);
            
            // 新しい通話では既存のトランスクリプトを取得しない
            // リアルタイムの更新のみに依存
          } else if (data.status === "completed" || data.status === "failed" || data.status === "ended" || data.status === "cancelled") {
            setCallStatus("ended");
          }
        }
      });

      // Listen for existing call data response
      newSocket.on("existing-call-data", (data) => {
        if (data && data.transcript && Array.isArray(data.transcript)) {
          const existingTranscript = data.transcript.map((entry: any) => ({
            speaker: entry.speaker as "AI" | "Customer" | "System",
            text: entry.text || entry.message,
            timestamp: entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString("ja-JP") : new Date().toLocaleTimeString("ja-JP"),
          }));

          if (existingTranscript.length > 0) {
            setTranscript(existingTranscript);
            setCallStatus(data.status === "completed" ? "ended" : "connected");
          }
        }
      });

      // Listen for transcript updates
      newSocket.on("transcript-update", (data) => {
        const normalizedDataPhone = normalizePhoneNumber(data.phoneNumber || '');
        const normalizedTargetPhone = normalizedPhone;
        
        // より柔軟な判定: CallSidが一致するか、電話番号が一致する場合
        const isCurrentCall = (callSid && data.callSid === callSid) || 
                             (normalizedDataPhone === normalizedTargetPhone);
        
        if (isCurrentCall) {
          // 重複チェック：秒単位で同じメッセージをチェック（ミリ秒の違いは無視）
          const timestamp = data.timestamp ? new Date(data.timestamp).toLocaleTimeString("ja-JP") : new Date().toLocaleTimeString("ja-JP");
          const messageId = `${data.speaker}-${data.text || data.message}-${timestamp}`;
          
          setProcessedMessages((prevProcessed) => {
            // 既に処理済みかチェック
            if (prevProcessed.has(messageId)) {
              return prevProcessed;
            }
            
            // 処理済みとしてマーク
            const newProcessed = new Set(prevProcessed);
            newProcessed.add(messageId);
            
            // speakerの正しいマッピング
            let speakerType: "AI" | "Customer" | "System" = "System";
            if (data.speaker === "ai" || data.speaker === "AI") {
              speakerType = "AI";
            } else if (data.speaker === "customer" || data.speaker === "Customer") {
              speakerType = "Customer";
            } else if (data.speaker === "system" || data.speaker === "System") {
              speakerType = "System";
            }
            
            const newEntry: TranscriptEntry = {
              speaker: speakerType,
              text: data.text || data.message,
              timestamp: timestamp,
            };
            
            // トランスクリプト更新（UI表示レベルでの最終重複チェック付き）
            setTranscript((prevTranscript) => {
              const filteredTranscript = prevTranscript.filter(entry => 
                entry.text !== "会話が開始されると、ここに表示されます"
              );
              
              // UI表示レベルでの最終重複チェック
              const isDuplicateInTranscript = filteredTranscript.some(entry => 
                entry.speaker === newEntry.speaker && 
                entry.text === newEntry.text && 
                entry.timestamp === newEntry.timestamp
              );
              
              if (isDuplicateInTranscript) {
                return filteredTranscript;
              }
              
              return [...filteredTranscript, newEntry];
            });
            
            return newProcessed;
          });
        }
      });

      // Listen for conversation events
      newSocket.on("conversation-update", (data) => {
        // 重複表示を防ぐため、conversation-updateイベントは何も処理しない
        return; // 何も処理しない
      });

      // Listen for transfer events
      newSocket.on("call-transferred", (data) => {
        if (data.callSid === callSid) {
          setTranscript((prev) => [
            ...prev,
            {
              speaker: "System",
              text: "オペレーターに転送されました",
              timestamp: new Date().toLocaleTimeString("ja-JP"),
            },
          ]);
        }
      });

      setSocket(newSocket);

      // トランスクリプトは空の状態から開始（実際のデータのみ表示）
      // 初期メッセージは不要

      // モック会話は無効化 - 実際のデータのみ表示
      // setTimeout(() => {
      //   if (transcript.length <= 1) {
      //     console.log("No real data received, showing mock conversation");
      //     simulateMockConversation();
      //   }
      // }, 2000);

      return () => {
        newSocket.emit("leave-call", { phoneNumber });
        newSocket.disconnect();
      };
    } else {
      // Clean up when modal closes
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      setTranscript([]);
    }
  }, [isOpen, phoneNumber]);

  // Mock conversation for demonstration - 無効化
  // const simulateMockConversation = () => {
  //   setCallStatus("connected");
  //   
  //   const mockMessages: TranscriptEntry[] = [
  //     {
  //       speaker: "AI",
  //       text: "お電話ありがとうございます。株式会社○○でございます。",
  //       timestamp: new Date().toLocaleTimeString("ja-JP"),
  //     },
  //     {
  //       speaker: "Customer",
  //       text: "もしもし、お世話になっています。",
  //       timestamp: new Date().toLocaleTimeString("ja-JP"),
  //     },
  //     {
  //       speaker: "AI",
  //       text: "お世話になっております。本日はどのようなご用件でしょうか？",
  //       timestamp: new Date().toLocaleTimeString("ja-JP"),
  //     },
  //     {
  //       speaker: "Customer",
  //       text: "新しいサービスについて聞きたいのですが。",
  //       timestamp: new Date().toLocaleTimeString("ja-JP"),
  //     },
  //     {
  //       speaker: "AI",
  //       text: "承知いたしました。弊社の新サービスについてご説明させていただきます。",
  //       timestamp: new Date().toLocaleTimeString("ja-JP"),
  //     },
  //   ];

  //   // Add messages progressively
  //   mockMessages.forEach((message, index) => {
  //     setTimeout(() => {
  //       setTranscript((prev) => [...prev, message]);
  //     }, (index + 1) * 1500);
  //   });
  // };

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  const handleTransfer = async () => {
    console.log("[取次ボタン] 開始", { 
      phoneNumber, 
      callStatus, 
      callSid,
      hasToken: !!localStorage.getItem('token')
    });
    
    setIsTransferring(true);
    try {
      // 電話番号からCall Sessionを取得して取次処理を実行
      const token = localStorage.getItem('token');
      console.log("[取次ボタン] トークン取得:", token ? "有効" : "無効");
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001'}/api/direct/handoff-direct`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ 
          phoneNumber: phoneNumber,
          callSid: callSid
        }),
      });

      console.log("[取次ボタン] APIレスポンス:", response.status, response.statusText);

      if (response.ok) {
        const data = await response.json();
        console.log("[取次ボタン] 成功:", data);
        setCallSid(data.callId);
        
        // Emit transfer event via socket
        if (socket) {
          socket.emit("transfer-call", { callSid: data.callId, phoneNumber });
        }
        
        setTranscript((prev) => [
          ...prev,
          {
            speaker: "System",
            text: "担当者にお繋ぎいたします。少々お待ちください。",
            timestamp: new Date().toLocaleTimeString("ja-JP"),
          },
        ]);
      } else {
        const errorData = await response.json();
        console.error("[取次ボタン] エラー:", errorData);
        throw new Error(errorData.error || errorData.message || "取次に失敗しました");
      }
    } catch (error) {
      console.error("Error transferring call:", error);
      setTranscript((prev) => [
        ...prev,
        {
          speaker: "System",
          text: `転送に失敗しました: ${error.message}`,
          timestamp: new Date().toLocaleTimeString("ja-JP"),
        },
      ]);
    } finally {
      setIsTransferring(false);
    }
  };

  const handleEndCall = async () => {
    if (callSid) {
      try {
        // Send end call request via API
        await fetch("/api/twilio/call/end", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callSid }),
        });
        
        // Emit end call event via socket
        if (socket) {
          socket.emit("end-call", { callSid, phoneNumber });
        }
      } catch (error) {
        // エラーは無視して進む
      }
    }
    
    setCallStatus("ended");
    setTranscript((prev) => [
      ...prev,
      {
        speaker: "System",
        text: "通話を終了しました。",
        timestamp: new Date().toLocaleTimeString("ja-JP"),
      },
    ]);
    
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  const getStatusColor = () => {
    switch (callStatus) {
      case "connecting":
        return "bg-yellow-500";
      case "connected":
        return "bg-green-500";
      case "ended":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusText = () => {
    switch (callStatus) {
      case "connecting":
        return "接続中";
      case "connected":
        return "通話中";
      case "ended":
        return "終了";
      default:
        return "不明";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl w-[90vw] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              一斉コール実行中
            </div>
            <div className="flex items-center gap-2">
              <Badge className={`${getStatusColor()} text-white ${callStatus === "connected" ? "animate-pulse" : ""}`}>
                {getStatusText()}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Call Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-600">
              選択された顧客に順番に電話をかけています...
            </p>
            <div className="mt-2 flex items-center gap-4">
              <span className="text-sm">
                <strong>電話番号:</strong> <span className="text-blue-600 font-mono">{phoneNumber}</span>
              </span>
              {callSid && (
                <span className="text-xs text-gray-500">
                  通話ID: {callSid.slice(0, 12)}...
                </span>
              )}
            </div>
          </div>

          {/* Conversation Transcript */}
          <div className="border rounded-lg h-[60vh]">
            <div className="bg-gray-100 px-4 py-3 border-b">
              <h3 className="font-semibold">会話内容</h3>
            </div>
            <ScrollArea className="h-[calc(60vh-50px)] p-4" ref={scrollRef}>
              <div className="space-y-3">
                {transcript.length === 0 ? (
                  <div className="text-center text-gray-400 py-12">
                    <div className="text-sm">会話が開始されると、ここに表示されます</div>
                  </div>
                ) : (
                  transcript.map((entry, index) => (
                    <div
                      key={index}
                      className={`flex items-start gap-3 p-3 rounded-lg ${
                        entry.speaker === "AI"
                          ? "bg-blue-50 border-l-4 border-l-blue-500"
                          : entry.speaker === "Customer"
                          ? "bg-green-50 border-l-4 border-l-green-500"
                          : "bg-gray-50 border-l-4 border-l-gray-500"
                      }`}
                    >
                      <div className="flex-shrink-0">
                        {entry.speaker === "AI" && (
                          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                            <Volume2 className="w-4 h-4 text-white" />
                          </div>
                        )}
                        {entry.speaker === "Customer" && (
                          <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                            <Mic className="w-4 h-4 text-white" />
                          </div>
                        )}
                        {entry.speaker === "System" && (
                          <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                            <Loader2 className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm">
                            {entry.speaker === "AI"
                              ? "AI オペレーター"
                              : entry.speaker === "Customer"
                              ? "お客様"
                              : "システム"}
                          </span>
                          <span className="text-xs text-gray-500">
                            {entry.timestamp}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">{entry.text}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-2">
            <div className="flex gap-2">
              <Button
                onClick={handleTransfer}
                disabled={isTransferring || callStatus !== "connected"}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                title={callStatus !== "connected" ? "通話中にのみ取次が可能です" : ""}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                {isTransferring ? "転送中..." : "取次"}
              </Button>
              <Button
                onClick={handleEndCall}
                variant="destructive"
              >
                コール状況を確認
              </Button>
            </div>
            <Button variant="outline" onClick={onClose}>
              閉じる
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

