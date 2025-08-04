import { NextResponse } from 'next/server'

const API_BASE_URL = `${process.env.BACKEND_URL}/api/customers/import`

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    
    // Forward the file to your MERN backend
    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to import customers' },
      { status: 500 }
    )
  }
}