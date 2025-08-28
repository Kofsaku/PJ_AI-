const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const CallSession = require('../models/CallSession');
const multer = require('multer');
const csvParser = require('csv-parser');
const fs = require('fs');
const path = require('path');

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Create a new customer
router.post('/', async (req, res) => {
  try {
    const customer = new Customer(req.body);
    await customer.save();
    res.status(201).send(customer);
  } catch (error) {
    res.status(400).send(error);
  }
});

// Get all customers
router.get('/', async (req, res) => {
  try {
    const customers = await Customer.find();
    res.send(customers);
  } catch (error) {
    res.status(500).send(error);
  }
});

// Get a specific customer
router.get('/:id', async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).send();
    }
    res.send(customer);
  } catch (error) {
    res.status(500).send(error);
  }
});

// Get customer's call history
router.get('/:id/call-history', async (req, res) => {
  try {
    const customerId = req.params.id;
    
    // Get customer to validate existence
    const customer = await Customer.findById(customerId);
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

// Update a customer
router.patch('/:id', async (req, res) => {
  const updates = Object.keys(req.body);
  const allowedUpdates = ['customer', 'date', 'time', 'duration', 'result', 'callResult', 'notes', 'address', 'email', 'phone', 'company', 'position', 'zipCode'];
  const isValidOperation = updates.every(update => allowedUpdates.includes(update));

  if (!isValidOperation) {
    return res.status(400).send({ error: 'Invalid updates!' });
  }

  try {
    const customer = await Customer.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!customer) {
      return res.status(404).send();
    }
    res.send(customer);
  } catch (error) {
    res.status(400).send(error);
  }
});

// Delete a customer
router.delete('/:id', async (req, res) => {
  try {
    const customer = await Customer.findByIdAndDelete(req.params.id);
    if (!customer) {
      return res.status(404).send();
    }
    res.send(customer);
  } catch (error) {
    res.status(500).send(error);
  }
});

// Import customers from CSV (file upload)
router.post('/import/file', upload.single('file'), async (req, res) => {
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
          // Insert all records into the database
          await Customer.insertMany(results);
          
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
router.post('/import', async (req, res) => {
  try {
    const { customers } = req.body;
    
    if (!customers || !Array.isArray(customers)) {
      return res.status(400).json({ error: 'Invalid data format' });
    }

    // Validate and format customer data
    const validatedCustomers = customers.map(customer => ({
      customer: customer.customer || 'Unknown',
      date: customer.date || new Date().toISOString().split('T')[0],
      time: customer.time || '00:00',
      duration: customer.duration || '0',
      result: customer.result || '未処理',
      notes: customer.notes || '',
      address: customer.address || '',
      phone: customer.phone || '',
      email: customer.email || '',
      company: customer.company || ''
    }));

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