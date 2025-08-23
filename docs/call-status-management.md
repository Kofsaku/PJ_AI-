# 通話ステータス管理の実装ガイド

## 実装内容

### 1. 通話中のステータス表示
- 通話中の顧客には緑色のアニメーション付きバッジ「通話中」を表示
- バッジはクリック可能で、クリックすると通話モーダルが開く

### 2. モーダルの再表示機能
- 通話中バッジをクリックすることで、いつでも通話モーダルを再度開くことができる
- モーダルを閉じても通話状態は維持される（実際の通話状態に依存）

### 3. WebSocketによるリアルタイム状態管理（推奨実装）

```typescript
// WebSocket connection for real-time call status
useEffect(() => {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001";
  const newSocket = io(backendUrl, {
    transports: ["websocket"],
  });

  newSocket.on("connect", () => {
    console.log("[Dashboard] WebSocket connected");
  });

  // Listen for call status updates
  newSocket.on("call-status", (data) => {
    const phoneNumber = data.phoneNumber?.startsWith('+81') 
      ? '0' + data.phoneNumber.substring(3) 
      : data.phoneNumber;
    
    // Find customer by phone number
    const customer = customers.find(c => c.phone === phoneNumber);
    if (customer) {
      const customerId = customer._id || customer.id?.toString();
      if (data.status === "in-progress" || data.status === "calling" || data.status === "ai-responding") {
        // 通話中状態に設定
        setCallingSessions(prev => new Set(prev).add(customerId));
      } else if (data.status === "completed" || data.status === "failed" || data.status === "ended") {
        // 通話終了状態に設定
        setCallingSessions(prev => {
          const newSet = new Set(prev);
          newSet.delete(customerId);
          return newSet;
        });
      }
    }
  });

  return () => {
    newSocket.disconnect();
  };
}, [customers]);
```

## UI変更点

### 通話中バッジ
```tsx
{callingSessions.has(customerId) ? (
  <Badge
    className="bg-green-500 text-white cursor-pointer hover:bg-green-600 transition-colors animate-pulse"
    onClick={() => {
      setActivePhoneNumber(customer.phone || "");
      setIsCallStatusModalOpen(true);
    }}
  >
    通話中
  </Badge>
) : (
  // 通常の状態表示
)}
```

### モーダル管理
```tsx
<CallStatusModal
  isOpen={isCallStatusModalOpen}
  onClose={() => {
    setIsCallStatusModalOpen(false);
    // モーダルを閉じても通話中状態は維持
    // WebSocketの状態更新に任せる
  }}
  phoneNumber={activePhoneNumber}
/>
```

## 利点
1. **リアルタイム性**: WebSocketにより実際の通話状態をリアルタイムで反映
2. **再アクセス可能**: 通話中のモーダルをいつでも再度開ける
3. **状態の一貫性**: サーバー側の状態と同期を保つ
4. **UX向上**: 視覚的にわかりやすい状態表示とアニメーション