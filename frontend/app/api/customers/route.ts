import { NextResponse, NextRequest } from 'next/server'

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5001'
const API_BASE_URL = `${BACKEND_URL}/api/customers`

// GET all customers or specific customer by ID
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const url = new URL(request.url)
    const customerId = url.searchParams.get('id')
    const callHistory = url.searchParams.get('call-history')
    
    console.log(`[Customer API] GET request - customerId: ${customerId || 'all'}, callHistory: ${callHistory}`)
    
    let apiUrl = API_BASE_URL
    if (customerId && callHistory === 'true') {
      apiUrl = `${API_BASE_URL}/${customerId}/call-history`
      console.log(`[Customer API] Fetching call history: ${apiUrl}`)
    } else if (customerId) {
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
// Node.js Runtime指定（Vercel Edge Runtime回避）
export const runtime = 'nodejs'

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

// PATCH (update) customer
export async function PATCH(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const url = new URL(request.url)
    const customerId = url.searchParams.get('id')
    const body = await request.json()
    
    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer ID is required for update' },
        { status: 400 }
      )
    }
    
    console.log(`[Customer API] Updating customer: ${customerId}`)
    
    const response = await fetch(`${API_BASE_URL}/${customerId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(body),
    })
    
    console.log(`[Customer API] PATCH Backend response status: ${response.status}`)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[Customer API] PATCH Backend error: ${response.status} - ${errorText}`)
      return NextResponse.json(
        { error: `Backend error: ${response.status}` },
        { status: response.status }
      )
    }
    
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('[Customer API] PATCH Error:', error)
    return NextResponse.json(
      { error: 'Failed to update customer', details: error.message },
      { status: 500 }
    )
  }
}

// DELETE customers (bulk or individual)
export async function DELETE(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const url = new URL(request.url)
    const customerId = url.searchParams.get('id')
    
    let apiUrl = API_BASE_URL
    let requestBody = null
    
    if (customerId) {
      // Individual customer deletion
      apiUrl = `${API_BASE_URL}/${customerId}`
      console.log(`[Customer API] Deleting individual customer: ${apiUrl}`)
    } else {
      // Bulk deletion
      const { ids } = await request.json()
      requestBody = JSON.stringify({ ids })
      console.log(`[Customer API] Bulk deleting customers: ${ids}`)
    }
    
    const response = await fetch(apiUrl, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: requestBody,
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