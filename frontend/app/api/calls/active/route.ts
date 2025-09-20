import { NextResponse } from 'next/server'

// Node.js Runtime指定（Vercel Edge Runtime回避）
export const runtime = 'nodejs'

// Store active calls in memory (in production, use a database or Redis)
let activeCalls: any[] = []

export async function GET() {
  try {
    // Clean up old calls (remove calls older than 10 minutes)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)
    activeCalls = activeCalls.filter(call => {
      const startTime = new Date(call.startTime)
      return startTime > tenMinutesAgo
    })
    
    // Return current active calls
    return NextResponse.json({ data: activeCalls })
  } catch (error) {
    console.error('Get active calls error:', error)
    return NextResponse.json({ data: [] })
  }
}

export async function POST(request: Request) {
  try {
    const callData = await request.json()
    
    // Add new call to active calls
    const newCall = {
      _id: callData.callSid || `call_${Date.now()}`,
      customerId: callData.customerId,
      customerName: callData.customerName || '不明',
      customerPhone: callData.phoneNumber,
      agentId: 'ai-system',
      agentName: 'AIコールシステム',
      status: callData.status || 'initiated',
      startTime: new Date().toISOString(),
      duration: 0,
      transcripts: []
    }
    
    activeCalls.push(newCall)
    
    return NextResponse.json({ data: newCall })
  } catch (error) {
    console.error('Error adding active call:', error)
    return NextResponse.json(
      { error: 'Failed to add active call' },
      { status: 500 }
    )
  }
}