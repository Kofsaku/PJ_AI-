"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ForgotPasswordPage() {
  const [resetEmail, setResetEmail] = useState("");
  const router = useRouter();

  const handlePasswordReset = (e: React.FormEvent) => {
    e.preventDefault();
    alert("パスワードリセットメールを送信しました");
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl font-medium">
            パスワードをお忘れですか？
          </CardTitle>
          <p className="text-sm text-gray-600 mt-2">
            メールアドレスを入力してください。パスワードリセット用のリンクをお送りします。
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handlePasswordReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">メールアドレス</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="example@email.com"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-orange-500 hover:bg-orange-600"
            >
              送信
            </Button>
          </form>
          <div className="text-center">
            <button
              onClick={() => router.push("/login")}
              className="text-sm text-blue-600 hover:underline"
            >
              ログイン画面に戻る
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
