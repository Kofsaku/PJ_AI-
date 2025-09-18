import { NextResponse, NextRequest } from 'next/server'

const API_BASE_URL = `${process.env.BACKEND_URL}/api/customers`

// GET single customer
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log(`[Customer API] GET request for customer ID: ${params.id}, API_BASE_URL: ${API_BASE_URL}`)
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    
    const response = await fetch(`${API_BASE_URL}/${params.id}`, {
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
    console.error('[Customer API] Frontend error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch customer' },
      { status: 500 }
    )
  }
}

// PATCH (update) customer
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    
    const response = await fetch(`${API_BASE_URL}/${params.id}`, {
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
    console.error('[Customer API] PATCH Frontend error:', error)
    return NextResponse.json(
      { error: 'Failed to update customer' },
      { status: 500 }
    )
  }
}

// DELETE customer
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    
    const response = await fetch(`${API_BASE_URL}/${params.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete customer' },
      { status: 500 }
    )
  }
}