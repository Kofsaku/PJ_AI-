'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { PhoneForwarded, Loader2 } from 'lucide-react';
import { callAPI } from '@/lib/api';
import { requestHandoff } from '@/lib/socket';
import { toast } from 'sonner';

interface HandoffButtonProps {
  callId: string;
  disabled?: boolean;
  onHandoffComplete?: () => void;
}

export function HandoffButton({ callId, disabled = false, onHandoffComplete }: HandoffButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [isHandingOff, setIsHandingOff] = useState(false);

  const handleHandoff = async () => {
    setIsHandingOff(true);
    
    try {
      // API経由で引き継ぎリクエスト
      await callAPI.handoffCall(callId, undefined, reason || 'Manual handoff requested');
      
      // WebSocket経由でも通知
      requestHandoff(callId, reason);
      
      toast.success('引き継ぎを開始しました');
      setIsOpen(false);
      setReason('');
      
      if (onHandoffComplete) {
        onHandoffComplete();
      }
    } catch (error: any) {
      console.error('Handoff error:', error);
      toast.error(
        error.response?.data?.message || '引き継ぎに失敗しました'
      );
    } finally {
      setIsHandingOff(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="default" 
          disabled={disabled || isHandingOff}
          className="w-full"
        >
          {isHandingOff ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              引き継ぎ中...
            </>
          ) : (
            <>
              <PhoneForwarded className="mr-2 h-4 w-4" />
              担当者に引き継ぐ
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>通話を引き継ぎますか？</DialogTitle>
          <DialogDescription>
            AIから人間の担当者に通話を転送します。必要に応じて引き継ぎ理由を入力してください。
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Textarea
            placeholder="引き継ぎ理由（オプション）例：お客様が詳細な説明を希望"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isHandingOff}
          >
            キャンセル
          </Button>
          <Button
            type="button"
            onClick={handleHandoff}
            disabled={isHandingOff}
          >
            {isHandingOff ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                処理中...
              </>
            ) : (
              '引き継ぐ'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}