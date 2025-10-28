const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const CallSession = require('../models/CallSession');
const multer = require('multer');
const csvParser = require('csv-parser');
const fs = require('fs');
const path = require('path');
const { protect } = require('../middlewares/authMiddleware');

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Create a new customer
router.post('/', protect, async (req, res) => {
  try {
    console.log('[Customer API] POST request from user:', req.user.email, 'userId:', req.user._id);
    const customer = new Customer({
      ...req.body,
      userId: req.user._id.toString()
    });
    await customer.save();
    console.log('[Customer API] Created customer with userId:', customer.userId);
    res.status(201).send(customer);
  } catch (error) {
    console.error('[Customer API] Create error:', error);
    res.status(400).send(error);
  }
});

// Get all customers OR get specific customer by query parameter
router.get('/', protect, async (req, res) => {
  try {
    console.log('[Customer API] GET request from user:', req.user.email, 'userId:', req.user._id);
    
    // Check if this is a specific customer request with query parameter
    if (req.query.id) {
      console.log('[Customer API] GET with query id:', req.query.id, 'call-history:', req.query['call-history']);
      
      // Check if call history is requested
      if (req.query['call-history'] === 'true') {
        console.log('[Customer API] Fetching call history for customer:', req.query.id);
        
        // First verify customer exists and user has access
        const customer = await Customer.findOne({
          _id: req.query.id,
          userId: req.user._id
        });
        
        if (!customer) {
          console.log('[Customer API] Customer not found for call history request');
          return res.status(404).send({ error: 'Customer not found' });
        }
        
        // Get call sessions for this customer
        const callSessions = await CallSession.find({ 
          customerId: req.query.id 
        })
        .sort({ createdAt: -1 })
        .populate('customerId', 'customer phone')
        .select('createdAt endTime duration status callResult transcript notes phoneNumber twilioCallSid');
        
        console.log('[Customer API] Found', callSessions.length, 'call history records');
        return res.send(callSessions);
      }
      
      // Get specific customer by query parameter
      const customer = await Customer.findOne({
        _id: req.query.id,
        userId: req.user._id
      });
      
      if (!customer) {
        console.log('[Customer API] Customer not found or access denied');
        return res.status(404).send({ error: 'Customer not found' });
      }
      
      console.log('[Customer API] Customer found and authorized via query');
      return res.send(customer);
    }
    
    // Get all customers
    const customers = await Customer.find({
      userId: req.user._id
    });
    console.log('[Customer API] Found', customers.length, 'customers for userId:', req.user._id);
    res.send(customers);
  } catch (error) {
    console.error('[Customer API] Error:', error);
    res.status(500).send(error);
  }
});

// Test endpoint to verify customer and auth
router.get('/:id/test', protect, async (req, res) => {
  try {
    console.log('[Customer API TEST] Request from user:', req.user.email, 'userId:', req.user._id, 'customerId:', req.params.id);

    const anyCustomer = await Customer.findById(req.params.id);
    const userCustomer = await Customer.findOne({ _id: req.params.id, userId: req.user._id });

    res.json({
      timestamp: new Date().toISOString(),
      user: req.user.email,
      userId: req.user._id,
      customerId: req.params.id,
      customerExists: !!anyCustomer,
      customerUserId: anyCustomer?.userId,
      hasAccess: !!userCustomer,
      test: 'Customer API test endpoint working'
    });
  } catch (error) {
    console.error('[Customer API TEST] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get a specific customer
router.get('/:id', protect, async (req, res) => {
  try {
    console.log('[Customer API] GET /:id request from user:', req.user.email, 'userId:', req.user._id, 'customerId:', req.params.id);

    // First check if customer exists at all
    const anyCustomer = await Customer.findById(req.params.id);
    if (!anyCustomer) {
      console.log('[Customer API] Customer not found in database:', req.params.id);
      return res.status(404).send({ error: 'Customer not found' });
    }

    console.log('[Customer API] Customer found with userId:', anyCustomer.userId, 'user userId:', req.user._id);

    // Then check with user filter
    const customer = await Customer.findOne({
      _id: req.params.id,
      userId: req.user._id
    });
    if (!customer) {
      console.log('[Customer API] Customer access denied - different user');
      return res.status(404).send({ error: 'Customer not found' });
    }
    
    console.log('[Customer API] Customer found and authorized');
    res.send(customer);
  } catch (error) {
    console.error('[Customer API] Error in GET /:id:', error);
    res.status(500).send(error);
  }
});

// Get customer's call history
router.get('/:id/call-history', protect, async (req, res) => {
  try {
    const customerId = req.params.id;
    
    // Get customer to validate existence and ownership
    const customer = await Customer.findOne({
      _id: customerId,
      userId: req.user._id
    });
    if (!customer) {
      return res.status(404).send({ error: 'Customer not found' });
    }
    
    // Get call sessions for this customer, sorted by creation date (newest first)
    const callSessions = await CallSession.find({ 
      customerId: customerId 
    })
    .sort({ createdAt: -1 })
    .populate('customerId', 'customer phone')
    .select('createdAt endTime duration status callResult transcript notes phoneNumber twilioCallSid');
    
    res.send(callSessions);
  } catch (error) {
    console.error('Error fetching call history:', error);
    res.status(500).send({ error: 'Failed to fetch call history' });
  }
});

// Update a customer via query parameter
router.patch('/', protect, async (req, res) => {
  if (req.query.id) {
    const updates = Object.keys(req.body);
    const allowedUpdates = ['customer', 'date', 'time', 'duration', 'result', 'callResult', 'notes', 'address', 'email', 'phone', 'company', 'position', 'zipCode'];
    const isValidOperation = updates.every(update => allowedUpdates.includes(update));

    console.log('[Customer API] PATCH via query from user:', req.user.email, 'userId:', req.user._id, 'customerId:', req.query.id, 'updates:', updates);

    if (!isValidOperation) {
      console.log('[Customer API] PATCH Invalid updates:', updates.filter(u => !allowedUpdates.includes(u)));
      return res.status(400).send({ error: 'Invalid updates!' });
    }

    try {
      const customer = await Customer.findOneAndUpdate(
        { _id: req.query.id, userId: req.user._id },
        req.body,
        { new: true, runValidators: true }
      );
      if (!customer) {
        console.log('[Customer API] PATCH Customer not found or access denied via query');
        return res.status(404).send({ error: 'Customer not found' });
      }
      
      console.log('[Customer API] PATCH Customer updated successfully via query');
      res.send(customer);
    } catch (error) {
      console.error('[Customer API] PATCH Error via query:', error);
      res.status(400).send(error);
    }
  } else {
    res.status(400).send({ error: 'Customer ID required' });
  }
});

// Update a customer
router.patch('/:id', protect, async (req, res) => {
  const updates = Object.keys(req.body);
  const allowedUpdates = ['customer', 'date', 'time', 'duration', 'result', 'callResult', 'notes', 'address', 'email', 'phone', 'company', 'position', 'zipCode'];
  const isValidOperation = updates.every(update => allowedUpdates.includes(update));

  console.log('[Customer API] PATCH /:id request from user:', req.user.email, 'userId:', req.user._id, 'customerId:', req.params.id, 'updates:', updates);

  if (!isValidOperation) {
    console.log('[Customer API] PATCH Invalid updates:', updates.filter(u => !allowedUpdates.includes(u)));
    return res.status(400).send({ error: 'Invalid updates!' });
  }

  try {
    // First check if customer exists at all
    const anyCustomer = await Customer.findById(req.params.id);
    if (!anyCustomer) {
      console.log('[Customer API] PATCH Customer not found in database:', req.params.id);
      return res.status(404).send({ error: 'Customer not found' });
    }
    
    console.log('[Customer API] PATCH Customer found with userId:', anyCustomer.userId, 'user userId:', req.user._id);

    const customer = await Customer.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      req.body,
      { new: true, runValidators: true }
    );
    if (!customer) {
      console.log('[Customer API] PATCH Customer access denied - different user');
      return res.status(404).send({ error: 'Customer not found' });
    }
    
    console.log('[Customer API] PATCH Customer updated successfully');
    res.send(customer);
  } catch (error) {
    console.error('[Customer API] PATCH Error:', error);
    res.status(400).send(error);
  }
});

// Delete a customer
router.delete('/:id', protect, async (req, res) => {
  try {
    const customer = await Customer.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });
    if (!customer) {
      return res.status(404).send();
    }
    res.send(customer);
  } catch (error) {
    res.status(500).send(error);
  }
});

// Import customers from CSV (file upload)
router.post('/import/file', protect, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No file uploaded');
    }

    const results = [];
    const filePath = path.join(__dirname, '../', req.file.path);

    // Read and parse the CSV file
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        try {
          // Add userId to all records
          const recordsWithUserId = results.map(record => ({
            ...record,
            userId: req.user._id.toString()
          }));
          // Insert all records into the database
          await Customer.insertMany(recordsWithUserId);
          
          // Delete the temporary file
          fs.unlinkSync(filePath);
          
          res.status(201).send({ message: `${results.length} customers imported successfully` });
        } catch (error) {
          fs.unlinkSync(filePath);
          res.status(400).send(error);
        }
      });
  } catch (error) {
    res.status(500).send(error);
  }
});

// Import customers from JSON (parsed CSV data)
router.post('/import', protect, async (req, res) => {
  try {
    const { customers } = req.body;

    console.log('[Customer Import] Received data:', JSON.stringify(req.body, null, 2));

    if (!customers || !Array.isArray(customers)) {
      return res.status(400).json({ error: 'Invalid data format' });
    }

    console.log('[Customer Import] Processing', customers.length, 'customers');
    console.log('[Customer Import] First customer sample:', customers[0]);

    // Validate and format customer data
    const validatedCustomers = customers.map((customer, index) => {
      // Validate required fields
      if (!customer.customer || !customer.customer.trim()) {
        throw new Error(`行 ${index + 2}: 顧客名(customer)は必須項目です`);
      }
      if (!customer.phone || !customer.phone.trim()) {
        throw new Error(`行 ${index + 2}: 電話番号(phone)は必須項目です`);
      }

      const validated = {
        userId: req.user._id.toString(),
        customer: customer.customer.trim(),
        date: customer.date || new Date().toISOString().split('T')[0],
        time: customer.time || '00:00',
        duration: customer.duration || '0',
        result: customer.result || '未対応',
        notes: customer.notes || '',
        address: customer.address || '',
        phone: customer.phone.trim(),
        email: customer.email || '',
        company: customer.company || '',
        url: customer.url || ''
      };

      if (index === 0) {
        console.log('[Customer Import] Original customer:', customer);
        console.log('[Customer Import] Validated customer:', validated);
        console.log('[Customer Import] Result field - original:', customer.result, 'validated:', validated.result);
      }

      return validated;
    });

    // Insert all records into the database
    const insertedCustomers = await Customer.insertMany(validatedCustomers);
    
    res.status(201).json({ 
      message: `${insertedCustomers.length} customers imported successfully`,
      count: insertedCustomers.length
    });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;