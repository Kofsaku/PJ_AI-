import { NextResponse, NextRequest } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001'
const API_BASE_URL = `${BACKEND_URL}/api/customers`

// GET all customers or specific customer by ID
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const url = new URL(request.url)
    const customerId = url.searchParams.get('id')
    
    console.log(`[Customer API] GET request - customerId: ${customerId || 'all'}`)
    
    let apiUrl = API_BASE_URL
    if (customerId) {
      apiUrl = `${API_BASE_URL}/${customerId}`
      console.log(`[Customer API] Fetching individual customer: ${apiUrl}`)
    }
    
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    
    console.log(`[Customer API] Backend response status: ${response.status}`)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[Customer API] Backend error: ${response.status} - ${errorText}`)
      return NextResponse.json(
        { error: `Backend error: ${response.status}` },
        { status: response.status }
      )
    }
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('[Customer API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch customers', details: error.message },
      { status: 500 }
    )
  }
}

// POST new customer
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    
    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create customer' },
      { status: 500 }
    )
  }
}

// DELETE customers
export async function DELETE(request: NextRequest) {
  try {
    const { ids } = await request.json()
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    
    const response = await fetch(API_BASE_URL, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ ids }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete customers' },
      { status: 500 }
    )
  }
}