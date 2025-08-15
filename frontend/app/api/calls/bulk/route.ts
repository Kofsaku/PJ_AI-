import { NextResponse, NextRequest } from 'next/server'

const accountSid = process.env.TWILIO_ACCOUNT_SID
const authToken = process.env.TWILIO_AUTH_TOKEN
const fromNumber = process.env.TWILIO_PHONE_NUMBER

// Twilio client initialization
const getTwilioClient = () => {
  const twilio = require('twilio')
  return twilio(accountSid, authToken)
}

export async function POST(request: NextRequest) {
  try {
    const { phoneNumbers, customerIds } = await request.json()
    
    if (!phoneNumbers || phoneNumbers.length === 0) {
      return NextResponse.json(
        { error: 'No phone numbers provided' },
        { status: 400 }
      )
    }

    const client = getTwilioClient()
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pj-ai-2t27-olw2j2em4-kofsakus-projects.vercel.app'
    
    // Create calls for each phone number with delay between calls
    const results = []
    
    for (let i = 0; i < phoneNumbers.length; i++) {
      const phoneNumber = phoneNumbers[i]
      const customerId = customerIds?.[i]
      
      try {
        // Format phone number for international dialing
        let formattedNumber = phoneNumber.replace(/[^\d+]/g, '')
        
        // Add country code if not present (assuming Japan)
        if (!formattedNumber.startsWith('+')) {
          if (formattedNumber.startsWith('0')) {
            // Remove leading 0 and add Japan country code
            formattedNumber = '+81' + formattedNumber.substring(1)
          } else if (!formattedNumber.startsWith('81')) {
            formattedNumber = '+81' + formattedNumber
          } else {
            formattedNumber = '+' + formattedNumber
          }
        }

        const call = await client.calls.create({
          url: `${baseUrl}/api/twilio/voice`,
          to: formattedNumber,
          from: fromNumber,
          statusCallback: `${baseUrl}/api/twilio/status`,
          statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
          statusCallbackMethod: 'POST',
          timeout: 30,
          record: false
        })

        // Track this call as active
        await fetch(`${baseUrl}/api/calls/active`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callSid: call.sid,
            customerId,
            phoneNumber: formattedNumber,
            status: call.status
          })
        }).catch(console.error)

        results.push({
          success: true,
          customerId,
          phoneNumber: formattedNumber,
          callSid: call.sid,
          status: call.status
        })
        
        // Add delay between calls (2 seconds)
        if (i < phoneNumbers.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      } catch (error) {
        console.error(`Failed to call ${phoneNumber}:`, error)
        results.push({
          success: false,
          customerId,
          phoneNumber,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
    
    // Count successful and failed calls
    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length

    return NextResponse.json({
      message: `Initiated ${successful} calls successfully`,
      successful,
      failed,
      results
    })
  } catch (error) {
    console.error('Bulk call error:', error)
    return NextResponse.json(
      { error: 'Failed to initiate bulk calls' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionIds = searchParams.get('sessionIds')
    
    const url = sessionIds 
      ? `${BACKEND_URL}/api/calls/bulk/status?sessionIds=${sessionIds}`
      : `${BACKEND_URL}/api/calls/bulk/status`
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`Backend responded with status: ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Get bulk call status error:', error)
    return NextResponse.json(
      { error: 'Failed to get call status' },
      { status: 500 }
    )
  }
}