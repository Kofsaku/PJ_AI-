import { NextRequest, NextResponse } from 'next/server'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const queryString = searchParams.toString()
    
    // Authorization ヘッダーを取得
    const authorization = request.headers.get('authorization')
    if (!authorization) {
      return NextResponse.json(
        { success: false, error: '認証が必要です' },
        { status: 401 }
      )
    }

    const response = await fetch(`${API_BASE_URL}/api/call-history/stats/summary?${queryString}`, {
      method: 'GET',
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/json',
      },
    })

    const data = await response.json()
    
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error('Call history stats proxy error:', error)
    return NextResponse.json(
      { success: false, error: 'API呼び出しでエラーが発生しました' },
      { status: 500 }
    )
  }
}