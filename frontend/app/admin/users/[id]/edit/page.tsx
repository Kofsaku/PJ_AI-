'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  companyName: string;
  phone: string;
  twilioPhoneNumber?: string;
  twilioPhoneNumberSid?: string;
  twilioPhoneNumberStatus?: 'active' | 'inactive' | 'pending';
  role: 'admin' | 'user';
}

interface TwilioNumber {
  phoneNumber: string;
  sid: string;
  friendlyName: string;
  isAssigned: boolean;
}

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [availableNumbers, setAvailableNumbers] = useState<TwilioNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [purchaseAreaCode, setPurchaseAreaCode] = useState('607');
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    if (userId) {
      fetchUser();
      fetchAvailableNumbers();
    }
  }, [userId]);

  const fetchUser = async () => {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch user');
      }

      const data = await response.json();
      setUser(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const fetchAvailableNumbers = async () => {
    try {
      const response = await fetch('/api/admin/twilio/numbers', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch available numbers');
      }

      const data = await response.json();
      setAvailableNumbers(data.numbers);
    } catch (err) {
      console.error('Error fetching numbers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignNumber = async (phoneNumber: string, sid: string) => {
    if (!user) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}/assign-number`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          phoneNumber,
          sid,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to assign number');
      }

      const data = await response.json();
      setUser(data.user);
      await fetchAvailableNumbers(); // Refresh available numbers
      alert('電話番号が正常に割り当てられました');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleUnassignNumber = async () => {
    if (!user || !user.twilioPhoneNumber) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}/unassign-number`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to unassign number');
      }

      const data = await response.json();
      setUser(data.user);
      await fetchAvailableNumbers(); // Refresh available numbers
      alert('電話番号の割り当てが解除されました');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handlePurchaseNumber = async () => {
    setPurchasing(true);
    try {
      const response = await fetch('/api/admin/twilio/numbers/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          areaCode: purchaseAreaCode,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to purchase number');
      }

      await fetchAvailableNumbers(); // Refresh available numbers
      alert('新しい電話番号を購入しました');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">エラーが発生しました</h1>
          <p className="text-gray-600 mb-4">{error || 'ユーザーが見つかりません'}</p>
          <button 
            onClick={() => router.push('/admin/users')}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            ユーザー一覧に戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <button 
            onClick={() => router.push('/admin/users')}
            className="text-indigo-600 hover:text-indigo-900"
          >
            ← ユーザー一覧に戻る
          </button>
          <h1 className="mt-4 text-2xl font-semibold text-gray-900">
            {user.firstName} {user.lastName} の編集
          </h1>
          <p className="text-sm text-gray-600">{user.email}</p>
        </div>

        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <div className="grid grid-cols-1 gap-6">
              
              {/* 現在の設定 */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">現在の電話番号設定</h3>
                <div className="bg-gray-50 p-4 rounded-lg">
                  {user.twilioPhoneNumber ? (
                    <div>
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            割り当て済み番号: {user.twilioPhoneNumber}
                          </p>
                          <p className="text-sm text-gray-500">
                            SID: {user.twilioPhoneNumberSid}
                          </p>
                          <span className={`inline-block px-2 py-1 text-xs rounded-full mt-2 ${
                            user.twilioPhoneNumberStatus === 'active' 
                              ? 'bg-green-100 text-green-800'
                              : user.twilioPhoneNumberStatus === 'inactive'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {user.twilioPhoneNumberStatus === 'active' && 'アクティブ'}
                            {user.twilioPhoneNumberStatus === 'inactive' && '非アクティブ'}
                            {user.twilioPhoneNumberStatus === 'pending' && '未設定'}
                          </span>
                        </div>
                        <button
                          onClick={handleUnassignNumber}
                          disabled={saving}
                          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
                        >
                          {saving ? '処理中...' : '割り当て解除'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500">電話番号が割り当てられていません</p>
                  )}
                </div>
              </div>

              {/* 利用可能な番号 */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">利用可能な電話番号</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {availableNumbers.filter(num => !num.isAssigned).length === 0 ? (
                    <p className="text-sm text-gray-500">利用可能な電話番号がありません</p>
                  ) : (
                    availableNumbers
                      .filter(num => !num.isAssigned)
                      .map((number) => (
                        <div key={number.sid} className="flex justify-between items-center p-3 border rounded-lg">
                          <div>
                            <p className="font-medium">{number.phoneNumber}</p>
                            <p className="text-sm text-gray-500">{number.friendlyName}</p>
                          </div>
                          <button
                            onClick={() => handleAssignNumber(number.phoneNumber, number.sid)}
                            disabled={saving}
                            className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:opacity-50"
                          >
                            {saving ? '処理中...' : '割り当て'}
                          </button>
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* 新しい番号の購入 */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">新しい電話番号を購入</h3>
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <p className="text-sm text-yellow-700 mb-4">
                    新しいTwilio電話番号を購入します（月額 $1.15）
                  </p>
                  <div className="flex items-center space-x-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        エリアコード
                      </label>
                      <select
                        value={purchaseAreaCode}
                        onChange={(e) => setPurchaseAreaCode(e.target.value)}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="607">607 (NY)</option>
                        <option value="417">417 (MO)</option>
                        <option value="202">202 (DC)</option>
                        <option value="415">415 (CA)</option>
                      </select>
                    </div>
                    <button
                      onClick={handlePurchaseNumber}
                      disabled={purchasing}
                      className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                    >
                      {purchasing ? '購入中...' : '購入'}
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}