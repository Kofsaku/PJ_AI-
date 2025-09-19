import { NextResponse, NextRequest } from 'next/server'

// Node.js Runtime指定（Vercel Edge Runtime回避）
export const runtime = 'nodejs'

// 共通のモデル定義とヘルパー関数
async function initializeMongoose() {
  const mongoose = require('mongoose')

  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://kosakutsubata:f10Kl6uGREjqHoWh@cluster0.cu3zvlo.mongodb.net/ai-call?retryWrites=true&w=majority&appName=Cluster0')
  }
  return mongoose
}

function defineModels(mongoose) {
  // Userモデル定義
  const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    companyId: String,
    role: { type: String, default: 'user' }
  })
  const User = mongoose.models.User || mongoose.model('User', UserSchema)

  // Customerモデル定義
  const CustomerSchema = new mongoose.Schema({
    companyId: {
      type: String,
      required: true,
      index: true
    },
    customer: {
      type: String,
      required: true
    },
    date: {
      type: String,
      required: true
    },
    time: {
      type: String,
      required: true
    },
    duration: {
      type: String,
      required: true
    },
    result: {
      type: String,
      required: true
    },
    notes: {
      type: String,
      required: false
    },
    address: {
      type: String,
      required: false
    },
    phone: {
      type: String,
      required: false
    },
    email: {
      type: String,
      required: false
    },
    company: {
      type: String,
      required: false
    }
  }, {
    timestamps: true
  })

  const Customer = mongoose.models.Customer || mongoose.model('Customer', CustomerSchema)

  // CallSessionモデル定義
  const CallSessionSchema = new mongoose.Schema({
    customerId: String,
    createdAt: Date,
    endTime: Date,
    duration: String,
    status: String,
    callResult: String,
    transcript: String,
    notes: String,
    phoneNumber: String,
    twilioCallSid: String
  }, {
    timestamps: true
  })

  const CallSession = mongoose.models.CallSession || mongoose.model('CallSession', CallSessionSchema)

  return { User, Customer, CallSession }
}

async function authenticateUser(token) {
  if (!token) {
    return null
  }

  const jwt = require('jsonwebtoken')
  const mongoose = await initializeMongoose()
  const { User } = defineModels(mongoose)

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || '7f4a8b9c3d2e1f0g5h6i7j8k9l0m1n2o3p4q5r6s7t8u9v0w1x2y3z4a5b6c7d8e9f')
    const user = await User.findById(decoded.userId || decoded.id)
    return user
  } catch (error) {
    return null
  }
}

// GET all customers or specific customer by ID
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const url = new URL(request.url)
    const customerId = url.searchParams.get('id')
    const callHistory = url.searchParams.get('call-history')

    console.log(`[Customer API] GET request - customerId: ${customerId || 'all'}, callHistory: ${callHistory}`)

    // 認証
    const user = await authenticateUser(token)
    if (!user) {
      return NextResponse.json(
        { error: 'Not authorized to access this route' },
        { status: 401 }
      )
    }

    console.log('[Customer API] GET request from user:', user.email, 'companyId:', user.companyId)

    const mongoose = await initializeMongoose()
    const { Customer, CallSession } = defineModels(mongoose)

    if (customerId && callHistory === 'true') {
      // Get call history for specific customer
      console.log(`[Customer API] Fetching call history for customer: ${customerId}`)

      // Get customer to validate existence and ownership
      const customer = await Customer.findOne({
        _id: customerId,
        companyId: user.companyId
      })
      if (!customer) {
        return NextResponse.json(
          { error: 'Customer not found' },
          { status: 404 }
        )
      }

      // Get call sessions for this customer, sorted by creation date (newest first)
      const callSessions = await CallSession.find({
        customerId: customerId
      })
      .sort({ createdAt: -1 })
      .populate('customerId', 'customer phone')
      .select('createdAt endTime duration status callResult transcript notes phoneNumber twilioCallSid')

      return NextResponse.json(callSessions)
    } else if (customerId) {
      // Get specific customer
      console.log(`[Customer API] Fetching individual customer: ${customerId}`)

      // First check if customer exists at all
      const anyCustomer = await Customer.findById(customerId)
      if (!anyCustomer) {
        console.log('[Customer API] Customer not found in database:', customerId)
        return NextResponse.json(
          { error: 'Customer not found' },
          { status: 404 }
        )
      }

      console.log('[Customer API] Customer found with companyId:', anyCustomer.companyId, 'user companyId:', user.companyId)

      // Then check with company filter
      const customer = await Customer.findOne({
        _id: customerId,
        companyId: user.companyId
      })
      if (!customer) {
        console.log('[Customer API] Customer access denied - different company')
        return NextResponse.json(
          { error: 'Customer not found' },
          { status: 404 }
        )
      }

      console.log('[Customer API] Customer found and authorized')
      return NextResponse.json(customer)
    } else {
      // Get all customers
      const customers = await Customer.find({
        companyId: user.companyId
      })
      console.log('[Customer API] Found', customers.length, 'customers for companyId:', user.companyId)
      return NextResponse.json(customers)
    }
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

    // 認証
    const user = await authenticateUser(token)
    if (!user) {
      return NextResponse.json(
        { error: 'Not authorized to access this route' },
        { status: 401 }
      )
    }

    console.log('[Customer API] POST request from user:', user.email, 'companyId:', user.companyId)

    const mongoose = await initializeMongoose()
    const { Customer } = defineModels(mongoose)

    const customer = new Customer({
      ...body,
      companyId: user.companyId
    })
    await customer.save()
    console.log('[Customer API] Created customer with companyId:', customer.companyId)

    return NextResponse.json(customer, { status: 201 })
  } catch (error) {
    console.error('[Customer API] Create error:', error)
    return NextResponse.json(
      { error: 'Failed to create customer', details: error.message },
      { status: 400 }
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

    // 認証
    const user = await authenticateUser(token)
    if (!user) {
      return NextResponse.json(
        { error: 'Not authorized to access this route' },
        { status: 401 }
      )
    }

    console.log(`[Customer API] PATCH /:id request from user:`, user.email, 'companyId:', user.companyId, 'customerId:', customerId)

    const mongoose = await initializeMongoose()
    const { Customer } = defineModels(mongoose)

    // 許可された更新フィールドの検証
    const updates = Object.keys(body)
    const allowedUpdates = ['customer', 'date', 'time', 'duration', 'result', 'callResult', 'notes', 'address', 'email', 'phone', 'company', 'position', 'zipCode']
    const isValidOperation = updates.every(update => allowedUpdates.includes(update))

    if (!isValidOperation) {
      console.log('[Customer API] PATCH Invalid updates:', updates.filter(u => !allowedUpdates.includes(u)))
      return NextResponse.json(
        { error: 'Invalid updates!' },
        { status: 400 }
      )
    }

    // First check if customer exists at all
    const anyCustomer = await Customer.findById(customerId)
    if (!anyCustomer) {
      console.log('[Customer API] PATCH Customer not found in database:', customerId)
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    console.log('[Customer API] PATCH Customer found with companyId:', anyCustomer.companyId, 'user companyId:', user.companyId)

    const customer = await Customer.findOneAndUpdate(
      { _id: customerId, companyId: user.companyId },
      body,
      { new: true, runValidators: true }
    )
    if (!customer) {
      console.log('[Customer API] PATCH Customer access denied - different company')
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      )
    }

    console.log('[Customer API] PATCH Customer updated successfully')
    return NextResponse.json(customer)
  } catch (error) {
    console.error('[Customer API] PATCH Error:', error)
    return NextResponse.json(
      { error: 'Failed to update customer', details: error.message },
      { status: 400 }
    )
  }
}

// DELETE customers (bulk or individual)
export async function DELETE(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    const url = new URL(request.url)
    const customerId = url.searchParams.get('id')

    // 認証
    const user = await authenticateUser(token)
    if (!user) {
      return NextResponse.json(
        { error: 'Not authorized to access this route' },
        { status: 401 }
      )
    }

    const mongoose = await initializeMongoose()
    const { Customer } = defineModels(mongoose)

    if (customerId) {
      // Individual customer deletion
      console.log(`[Customer API] Deleting individual customer: ${customerId}`)
      const customer = await Customer.findOneAndDelete({
        _id: customerId,
        companyId: user.companyId
      })
      if (!customer) {
        return NextResponse.json(
          { error: 'Customer not found' },
          { status: 404 }
        )
      }
      return NextResponse.json(customer)
    } else {
      // Bulk deletion
      const { ids } = await request.json()
      console.log(`[Customer API] Bulk deleting customers:`, ids)

      const result = await Customer.deleteMany({
        _id: { $in: ids },
        companyId: user.companyId
      })

      return NextResponse.json({
        message: `${result.deletedCount} customers deleted successfully`,
        deletedCount: result.deletedCount
      })
    }
  } catch (error) {
    console.error('[Customer API] DELETE Error:', error)
    return NextResponse.json(
      { error: 'Failed to delete customers', details: error.message },
      { status: 500 }
    )
  }
}