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
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && phoneNumber) {
      // Clear previous transcript
      setTranscript([]);
      setCallStatus("connecting");
      
      // 電話番号を正規化（0906... 形式に統一）
      const normalizedPhone = phoneNumber.startsWith('+81') ? '0' + phoneNumber.substring(3) : phoneNumber;
      console.log("[CallStatusModal] 初期化:", { 
        originalPhone: phoneNumber, 
        normalizedPhone,
        isOpen 
      });
      
      // Initialize socket connection
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001";
      console.log("[CallStatusModal] バックエンド接続:", backendUrl);
      
      const newSocket = io(backendUrl, {
        transports: ["websocket"],
      });

      newSocket.on("connect", () => {
        console.log("[CallStatusModal] Socket接続成功");
        console.log("[CallStatusModal] Socket ID:", newSocket.id);
        // Join room for this specific call
        console.log("[CallStatusModal] join-callイベント送信:", { phoneNumber: normalizedPhone });
        newSocket.emit("join-call", { phoneNumber: normalizedPhone });
      });
      
      // join-call成功確認
      newSocket.on("joined-call-room", (data) => {
        console.log("[CallStatusModal] joined-call-room受信:", data);
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
        console.log("[CallStatusModal] bulk-calls-started受信:", data);
        if (data.sessions && Array.isArray(data.sessions)) {
          const session = data.sessions.find((s: any) => {
            const normalizedSessionPhone = s.phoneNumber?.startsWith('+81') 
              ? '0' + s.phoneNumber.substring(3) 
              : s.phoneNumber;
            const normalizedTargetPhone = normalizedPhone;
            return normalizedSessionPhone === normalizedTargetPhone;
          });
          
          if (session) {
            console.log("[CallStatusModal] Session found:", session);
            setCallSid(session.twilioCallSid || session.id);
            setCallStatus("connecting");
          }
        }
      });

      // Listen for call status updates
      newSocket.on("call-status", (data) => {
        console.log("[CallStatusModal] call-status受信:", data);
        // 電話番号のフォーマットを統一して比較
        const normalizePhone = (phone: string) => {
          if (!phone) return '';
          // +81を0に変換
          if (phone.startsWith('+81')) {
            return '0' + phone.substring(3);
          }
          return phone;
        };
        
        const normalizedDataPhone = normalizePhone(data.phoneNumber);
        const normalizedTargetPhone = normalizePhone(phoneNumber);
        
        console.log("[CallStatusModal] 電話番号比較:", {
          data: normalizedDataPhone,
          target: normalizedTargetPhone,
          match: normalizedDataPhone === normalizedTargetPhone
        });
        
        if (normalizedDataPhone === normalizedTargetPhone || data.callSid === callSid || data.callId === callSid) {
          console.log("[CallStatusModal] ステータス更新:", data.status);
          if (data.status === "in-progress" || data.status === "calling") {
            setCallStatus("connected");
            setCallSid(data.callSid || data.callId || data.twilioCallSid);
            console.log("[CallStatusModal] 通話中に変更, CallSid:", data.callSid || data.callId || data.twilioCallSid);
          } else if (data.status === "completed" || data.status === "failed") {
            setCallStatus("ended");
          }
        }
      });

      // Listen for transcript updates
      newSocket.on("transcript-update", (data) => {
        console.log("[CallStatusModal] transcript-update受信:", data);
        
        // 電話番号を正規化して比較
        const normalizePhone = (phone: string) => {
          if (!phone) return '';
          if (phone.startsWith('+81')) {
            return '0' + phone.substring(3);
          }
          return phone;
        };
        
        const normalizedDataPhone = normalizePhone(data.phoneNumber || '');
        const normalizedTargetPhone = normalizePhone(phoneNumber);
        
        console.log("[CallStatusModal] トランスクリプト電話番号比較:", {
          data: normalizedDataPhone,
          target: normalizedTargetPhone,
          speaker: data.speaker,
          match: normalizedDataPhone === normalizedTargetPhone || data.callSid === callSid
        });
        
        // Only add transcript for this specific call
        if (normalizedDataPhone === normalizedTargetPhone || data.callSid === callSid || data.callId === callSid) {
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
            timestamp: data.timestamp ? new Date(data.timestamp).toLocaleTimeString("ja-JP") : new Date().toLocaleTimeString("ja-JP"),
          };
          console.log("[CallStatusModal] トランスクリプト追加:", newEntry);
          setTranscript((prev) => [...prev, newEntry]);
        }
      });

      // Listen for conversation events
      newSocket.on("conversation-update", (data) => {
        console.log("[CallStatusModal] conversation-update受信:", data);
        
        const normalizePhone = (phone: string) => {
          if (!phone) return '';
          if (phone.startsWith('+81')) {
            return '0' + phone.substring(3);
          }
          return phone;
        };
        
        const normalizedDataPhone = normalizePhone(data.phoneNumber || '');
        const normalizedTargetPhone = normalizePhone(phoneNumber);
        
        if (normalizedDataPhone === normalizedTargetPhone || data.callSid === callSid || data.callId === callSid) {
          const newEntry: TranscriptEntry = {
            speaker: data.role === "assistant" ? "AI" : data.role === "customer" ? "Customer" : "System",
            text: data.content,
            timestamp: new Date().toLocaleTimeString("ja-JP"),
          };
          console.log("[CallStatusModal] 会話追加:", newEntry);
          setTranscript((prev) => [...prev, newEntry]);
        }
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

      // Add initial connecting message
      setTranscript([
        {
          speaker: "System",
          text: `${phoneNumber} に接続中...`,
          timestamp: new Date().toLocaleTimeString("ja-JP"),
        },
      ]);

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
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5001'}/api/calls/handoff-by-phone`, {
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
        console.error("Error ending call:", error);
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
                  <div className="text-center text-gray-500 py-12">
                    <Loader2 className="h-8 w-8 mx-auto mb-3 animate-spin text-blue-500" />
                    接続中...
                  </div>
                ) : (
                  transcript.map((entry, index) => (
                    <div
                      key={index}
                      className={`flex ${
                        entry.speaker === "System" ? "justify-center" :
                        entry.speaker === "AI" ? "justify-start" : "justify-end"
                      }`}
                    >
                      {entry.speaker === "System" ? (
                        <div className="max-w-[80%] text-center">
                          <div className="inline-flex items-center gap-2 px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-600">
                            <Phone className="h-3 w-3" />
                            <span>{entry.timestamp}</span>
                          </div>
                          <p className="mt-1 text-sm text-gray-600">{entry.text}</p>
                        </div>
                      ) : (
                        <div className={`max-w-[60%] ${
                          entry.speaker === "Customer" ? "ml-auto" : "mr-auto"
                        }`}>
                          <div className={`flex items-start gap-2 ${
                            entry.speaker === "Customer" ? "flex-row-reverse" : ""
                          }`}>
                            <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                              entry.speaker === "AI" 
                                ? "bg-blue-100" 
                                : "bg-green-100"
                            }`}>
                              {entry.speaker === "AI" ? (
                                <Volume2 className="h-5 w-5 text-blue-600" />
                              ) : (
                                <Mic className="h-5 w-5 text-green-600" />
                              )}
                            </div>
                            <div className="flex-1">
                              <div className={`flex items-center gap-2 mb-1 ${
                                entry.speaker === "Customer" ? "justify-end" : ""
                              }`}>
                                <span className={`text-xs font-semibold ${
                                  entry.speaker === "AI" ? "text-blue-600" : "text-green-600"
                                }`}>
                                  {entry.speaker === "AI" ? "AI" : "顧客"}
                                </span>
                                <span className="text-xs text-gray-500">{entry.timestamp}</span>
                              </div>
                              <div className={`rounded-2xl px-4 py-3 ${
                                entry.speaker === "AI"
                                  ? "bg-blue-50 text-blue-900 border border-blue-200"
                                  : "bg-white text-gray-900 border border-gray-300"
                              }`}>
                                <p className="text-sm leading-relaxed">{entry.text}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
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

