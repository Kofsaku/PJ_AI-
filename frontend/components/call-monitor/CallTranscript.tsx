'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Bot, User, Headphones } from 'lucide-react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { monitorCall, stopMonitoringCall, getSocket } from '@/lib/socket';

interface TranscriptMessage {
  timestamp: string;
  speaker: 'ai' | 'customer' | 'agent';
  message: string;
  confidence?: number;
}

interface CallTranscriptProps {
  callId: string;
  initialTranscript?: TranscriptMessage[];
}

export function CallTranscript({ callId, initialTranscript = [] }: CallTranscriptProps) {
  const [transcript, setTranscript] = useState<TranscriptMessage[]>(initialTranscript);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [isAutoScroll, setIsAutoScroll] = useState(true);

  useEffect(() => {
    // 通話のモニタリング開始
    monitorCall(callId);

    // トランスクリプト更新の購読
    const socket = getSocket();
    if (socket) {
      socket.on('transcript-update', (data: any) => {
        if (data.callId === callId) {
          setTranscript(prev => [...prev, {
            timestamp: data.timestamp || new Date().toISOString(),
            speaker: data.speaker,
            message: data.message,
            confidence: data.confidence
          }]);
        }
      });
    }

    return () => {
      stopMonitoringCall(callId);
      if (socket) {
        socket.off('transcript-update');
      }
    };
  }, [callId]);

  useEffect(() => {
    // 自動スクロール
    if (isAutoScroll && scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [transcript, isAutoScroll]);

  const getSpeakerIcon = (speaker: string) => {
    switch (speaker) {
      case 'ai':
        return <Bot className="h-4 w-4" />;
      case 'agent':
        return <Headphones className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getSpeakerLabel = (speaker: string) => {
    switch (speaker) {
      case 'ai':
        return 'AI';
      case 'agent':
        return '担当者';
      case 'customer':
        return '顧客';
      default:
        return speaker;
    }
  };

  const getSpeakerColor = (speaker: string) => {
    switch (speaker) {
      case 'ai':
        return 'bg-blue-50 border-blue-200';
      case 'agent':
        return 'bg-green-50 border-green-200';
      case 'customer':
        return 'bg-gray-50 border-gray-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle>会話トランスクリプト</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {transcript.length} メッセージ
            </Badge>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isAutoScroll}
                onChange={(e) => setIsAutoScroll(e.target.checked)}
                className="rounded"
              />
              自動スクロール
            </label>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <ScrollArea className="h-[500px] pr-4" ref={scrollAreaRef}>
          <div className="space-y-4">
            {transcript.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                会話が開始されるとここに表示されます
              </div>
            ) : (
              transcript.map((item, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg border ${getSpeakerColor(item.speaker)}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-1">
                      {getSpeakerIcon(item.speaker)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">
                          {getSpeakerLabel(item.speaker)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(item.timestamp), 'HH:mm:ss', { locale: ja })}
                        </span>
                        {item.confidence && item.confidence < 0.8 && (
                          <Badge variant="outline" className="text-xs">
                            信頼度: {Math.round(item.confidence * 100)}%
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm">{item.message}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}