require('dotenv').config(); // For CommonJS
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const connectDB = require('./config/db');
// Load env vars
dotenv.config({ path: './.env' });

// Connect to database
connectDB();

// Route files
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const customerRoutes = require('./routes/customers');
const agentRoutes = require('./routes/agentRoutes');
const callRoutes = require('./routes/callRoutes');
const twilioRoutes = require('./routes/twilioRoutes');
const bulkCallRoutes = require('./routes/bulkCallRoutes');
const conferenceRoutes = require('./routes/conferenceRoutes');
const companyRoutes = require('./routes/companyRoutes');
const audioRoutes = require('./routes/audioRoutes');
const handoffRoutes = require('./routes/handoffRoutes');
const handoffDirectRoutes = require('./routes/handoffDirectRoutes');
const companyAdminRoutes = require('./routes/companyAdminRoutes');
const healthRoutes = require('./routes/healthRoutes');
const callHistoryRoutes = require('./routes/callHistoryRoutes');
const testRoutes = require('./routes/testRoutes');

const app = express();

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // For Twilio webhooks

// Enable CORS with specific configuration
app.use(cors({
  origin: function(origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001', 
      'http://localhost:3002',
      process.env.FRONTEND_URL
    ].filter(Boolean);
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(null, true); // 開発環境では全て許可
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

// Set security headers
app.use(helmet());

// Dev logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Mount routers
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/company', require('./routes/companyRoutes')); // User's company info routes
app.use('/api/customers', customerRoutes);
app.use('/api/agents', agentRoutes);
// Mount bulk routes BEFORE general call routes to avoid auth middleware conflict
app.use('/api/calls', bulkCallRoutes);
app.use('/api/calls', conferenceRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/twilio', twilioRoutes);
app.use('/api/audio', audioRoutes);
app.use('/api/direct', handoffDirectRoutes); // Direct routes without auth
app.use('/api/test', testRoutes); // Test routes for debugging
app.use('/api', handoffRoutes);
app.use('/api/company-admin', companyAdminRoutes);
app.use('/api/call-history', callHistoryRoutes);
app.use('/', healthRoutes);

// Serve static files from uploads directory
app.use('/uploads', express.static('uploads'));

// Database cleanup endpoint
const { cleanupOldCalls } = require('./cleanup-calls');
app.post('/api/admin/cleanup-calls', async (req, res) => {
  try {
    const result = await cleanupOldCalls();
    res.json(result);
  } catch (error) {
    console.error('Cleanup error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Error handler
app.use(require('./middlewares/errorHandler'));

const PORT = process.env.PORT || 5000;

// Create server first
const server = require('http').createServer(app);

// Initialize WebSocket service
const webSocketService = require('./services/websocket');
webSocketService.initialize(server);

// Initialize call timeout manager
const callTimeoutManager = require('./services/callTimeoutManager');
callTimeoutManager.startCleanupTask();

// Start listening with error handling
server.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  
  // Set up periodic cleanup of stale call sessions
  const bulkCallController = require('./controllers/bulkCallController');
  const cleanupInterval = 5 * 60 * 1000; // Every 5 minutes
  
  setInterval(async () => {
    try {
      console.log('[Periodic Cleanup] Running call session cleanup...');
      // Create a mock req and res for the cleanup function
      const mockReq = {};
      const mockRes = {
        status: () => mockRes,
        json: (data) => {
          console.log('[Periodic Cleanup] Result:', data.message);
          return mockRes;
        }
      };
      
      await bulkCallController.cleanupOldSessions(mockReq, mockRes);
    } catch (error) {
      console.error('[Periodic Cleanup] Error:', error);
    }
  }, cleanupInterval);
  
  console.log(`[Cleanup] Automatic cleanup scheduled every ${cleanupInterval / 1000 / 60} minutes`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use.`);
    console.log('Attempting to kill existing process and retry...');
    
    // Try to kill the process using the port and retry
    const { exec } = require('child_process');
    exec(`lsof -ti:${PORT} | xargs kill -9`, (error) => {
      if (!error) {
        console.log('Previous process killed. Retrying in 2 seconds...');
        setTimeout(() => {
          server.listen(PORT);
        }, 2000);
      } else {
        console.error('Failed to kill existing process. Please manually stop the process using port', PORT);
        process.exit(1);
      }
    });
  } else {
    console.error('Server error:', err);
    process.exit(1);
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error('Unhandled Promise Rejection:');
  console.error(err);
  console.error('Stack:', err.stack);
  // Don't exit immediately to see the error
  server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:');
  console.error(err);
  console.error('Stack:', err.stack);
  // Exit after logging
  process.exit(1);
});