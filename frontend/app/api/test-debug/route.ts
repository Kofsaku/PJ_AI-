import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    timestamp: new Date().toISOString(),
    backendUrl: process.env.BACKEND_URL,
    message: 'Frontend API test endpoint working',
    version: '1.0.0'
  })
}