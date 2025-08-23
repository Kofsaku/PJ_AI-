const twilioService = require('../services/twilioService');
const CallSession = require('../models/CallSession');
const Customer = require('../models/Customer');
const webSocketService = require('../services/websocket');

// Initiate bulk calls to selected customers
exports.initiateBulkCalls = async (req, res) => {
  console.log('=== Bulk Call Request ===');
  console.log('Request Body:', req.body);
  console.log('User:', req.user);
  
  try {
    const { phoneNumbers, customerIds } = req.body;

    console.log('Phone Numbers:', phoneNumbers);
    console.log('Customer IDs:', customerIds);

    if (!phoneNumbers || phoneNumbers.length === 0) {
      console.log('❌ No phone numbers provided');
      return res.status(400).json({ 
        error: 'No phone numbers provided' 
      });
    }

    // Create call sessions for tracking
    const callSessions = [];
    const callPromises = [];

    for (let i = 0; i < phoneNumbers.length; i++) {
      const phoneNumber = phoneNumbers[i];
      const customerId = customerIds ? customerIds[i] : null;

      // Create a call session
      const session = new CallSession({
        phoneNumber,
        customerId,
        status: 'initiating',
        startTime: new Date(),
      });

      await session.save();
      callSessions.push(session);

      // Initiate the call via Twilio (pass user ID from request if available)
      const callPromise = twilioService.makeCall(phoneNumber, session._id, req.user?.id)
        .then(call => {
          session.twilioCallSid = call.sid;
          session.status = 'calling';
          return session.save();
        })
        .catch(error => {
          session.status = 'failed';
          session.error = error.message;
          return session.save();
        });

      callPromises.push(callPromise);
    }

    // Wait for all calls to be initiated
    await Promise.all(callPromises);

    // Broadcast new calls via WebSocket
    webSocketService.broadcastCallEvent('bulk-calls-started', {
      sessions: callSessions.map(s => ({
        id: s._id,
        phoneNumber: s.phoneNumber,
        status: s.status,
        twilioCallSid: s.twilioCallSid
      }))
    });

    // Send active calls update
    const activeCalls = await CallSession.getActiveCalls();
    webSocketService.broadcastCallEvent('active-calls', activeCalls);

    res.status(200).json({
      message: `Initiated ${phoneNumbers.length} calls`,
      sessions: callSessions.map(s => ({
        id: s._id,
        phoneNumber: s.phoneNumber,
        status: s.status,
        twilioCallSid: s.twilioCallSid
      }))
    });

  } catch (error) {
    console.error('Bulk call error:', error);
    res.status(500).json({ 
      error: 'Failed to initiate bulk calls',
      details: error.message 
    });
  }
};

// Get status of bulk calls
exports.getBulkCallStatus = async (req, res) => {
  try {
    const { sessionIds } = req.query;
    
    let query = {};
    if (sessionIds) {
      const ids = sessionIds.split(',');
      query._id = { $in: ids };
    }

    const sessions = await CallSession.find(query)
      .populate('customerId', 'customer phone')
      .sort('-createdAt')
      .limit(100);

    res.status(200).json({
      sessions: sessions.map(s => ({
        id: s._id,
        phoneNumber: s.phoneNumber,
        customer: s.customerId,
        status: s.status,
        startTime: s.startTime,
        endTime: s.endTime,
        duration: s.duration,
        twilioCallSid: s.twilioCallSid
      }))
    });

  } catch (error) {
    console.error('Get bulk call status error:', error);
    res.status(500).json({ 
      error: 'Failed to get call status',
      details: error.message 
    });
  }
};

// Cancel ongoing bulk calls
exports.cancelBulkCalls = async (req, res) => {
  try {
    const { sessionIds } = req.body;

    if (!sessionIds || sessionIds.length === 0) {
      return res.status(400).json({ 
        error: 'No session IDs provided' 
      });
    }

    const sessions = await CallSession.find({
      _id: { $in: sessionIds },
      status: { $in: ['initiating', 'calling', 'in-progress'] }
    });

    const cancelPromises = sessions.map(async (session) => {
      if (session.twilioCallSid) {
        try {
          await twilioService.endCall(session.twilioCallSid);
        } catch (error) {
          console.error(`Failed to end call ${session.twilioCallSid}:`, error);
        }
      }
      session.status = 'cancelled';
      session.endTime = new Date();
      return session.save();
    });

    await Promise.all(cancelPromises);

    res.status(200).json({
      message: `Cancelled ${sessions.length} calls`,
      cancelledSessions: sessions.map(s => s._id)
    });

  } catch (error) {
    console.error('Cancel bulk calls error:', error);
    res.status(500).json({ 
      error: 'Failed to cancel calls',
      details: error.message 
    });
  }
};

// Clean up old call sessions
exports.cleanupOldSessions = async (req, res) => {
  try {
    console.log('=== Cleanup Old Sessions ===');
    
    // Define cutoff date (older than 24 hours)
    const cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    console.log('Cutoff date:', cutoffDate);
    
    // Find old sessions that are still marked as active
    const oldSessions = await CallSession.find({
      startTime: { $lt: cutoffDate },
      status: { $in: ['initiating', 'calling', 'in-progress', 'ai-responding'] }
    });
    
    console.log(`Found ${oldSessions.length} old sessions to clean up`);
    
    // Update status to completed for old sessions
    const updateResult = await CallSession.updateMany(
      {
        startTime: { $lt: cutoffDate },
        status: { $in: ['initiating', 'calling', 'in-progress', 'ai-responding'] }
      },
      {
        $set: {
          status: 'completed',
          endTime: new Date()
        }
      }
    );
    
    console.log(`Updated ${updateResult.modifiedCount} sessions`);
    
    res.status(200).json({
      message: `Cleaned up ${updateResult.modifiedCount} old sessions`,
      cleanedCount: updateResult.modifiedCount,
      cutoffDate: cutoffDate
    });

  } catch (error) {
    console.error('Cleanup sessions error:', error);
    res.status(500).json({ 
      error: 'Failed to cleanup sessions',
      details: error.message 
    });
  }
};