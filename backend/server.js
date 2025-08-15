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
const customerRoutes = require('./routes/customers');
const agentRoutes = require('./routes/agentRoutes');
const callRoutes = require('./routes/callRoutes');
const twilioRoutes = require('./routes/twilioRoutes');

const app = express();

// Body parser
app.use(express.json());

// Enable CORS
app.use(cors());

// Set security headers
app.use(helmet());

// Dev logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Mount routers
app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/twilio', twilioRoutes);

// Error handler
app.use(require('./middlewares/errorHandler'));

const PORT = process.env.PORT || 5000;

const server = app.listen(
  PORT,
  console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`)
);

// Initialize WebSocket service
const webSocketService = require('./services/websocket');
webSocketService.initialize(server);

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});