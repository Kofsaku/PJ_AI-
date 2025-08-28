const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/authMiddleware');
const CallSession = require('../models/CallSession');
const Customer = require('../models/Customer');

// 認証必須
router.use(protect);

// @desc    Get call history with filters
// @route   GET /api/call-history
// @access  Private
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search,
      status,
      result,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // クエリ構築
    const query = {};
    
    // 検索条件
    if (search) {
      // 顧客名で検索するため、まず顧客を検索
      const customers = await Customer.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } }
        ]
      });
      const customerIds = customers.map(c => c._id);
      query.customerId = { $in: customerIds };
    }

    // ステータスフィルター
    if (status) {
      query.status = status;
    }

    // 結果フィルター
    if (result) {
      query.callResult = result;
    }

    // 日付範囲フィルター
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    // ページネーション計算
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // ソート設定
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // データ取得
    const [calls, total] = await Promise.all([
      CallSession.find(query)
        .populate('customerId', 'name company phone email')
        .populate('assignedAgent', 'firstName lastName email')
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      CallSession.countDocuments(query)
    ]);

    // データ整形
    const formattedCalls = calls.map(call => {
      // 通話時間を計算（秒単位）
      let duration = 0;
      if (call.endTime && call.startTime) {
        duration = Math.floor((new Date(call.endTime) - new Date(call.startTime)) / 1000);
      } else if (call.duration) {
        duration = call.duration;
      }

      // 分:秒形式に変換
      const minutes = Math.floor(duration / 60);
      const seconds = duration % 60;
      const formattedDuration = `${minutes}分${seconds}秒`;

      return {
        id: call._id,
        customer: call.customerId ? {
          id: call.customerId._id,
          name: call.customerId.name || '不明',
          phone: call.customerId.phone || call.phoneNumber || '不明',
          company: call.customerId.company || ''
        } : {
          name: '不明',
          phone: call.phoneNumber || '不明',
          company: ''
        },
        date: call.createdAt,
        startTime: call.startTime,
        endTime: call.endTime,
        duration: formattedDuration,
        durationSeconds: duration,
        status: call.status,
        result: call.callResult || '未設定',
        notes: call.notes || '',
        assignedAgent: call.assignedAgent ? {
          id: call.assignedAgent._id,
          name: `${call.assignedAgent.firstName || ''} ${call.assignedAgent.lastName || ''}`.trim() || call.assignedAgent.email
        } : null,
        twilioCallSid: call.twilioCallSid,
        recordingUrl: call.recordingUrl,
        hasTranscript: call.transcript && call.transcript.length > 0,
        transcriptCount: call.transcript ? call.transcript.length : 0
      };
    });

    // ページネーション情報
    const totalPages = Math.ceil(total / parseInt(limit));
    const currentPage = parseInt(page);

    res.json({
      success: true,
      data: formattedCalls,
      pagination: {
        currentPage,
        totalPages,
        totalItems: total,
        itemsPerPage: parseInt(limit),
        hasNext: currentPage < totalPages,
        hasPrev: currentPage > 1
      }
    });

  } catch (error) {
    console.error('Error fetching call history:', error);
    res.status(500).json({
      success: false,
      error: 'コール履歴の取得に失敗しました'
    });
  }
});

// @desc    Get call details with transcript
// @route   GET /api/call-history/:id
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const call = await CallSession.findById(req.params.id)
      .populate('customerId', 'name company phone email')
      .populate('assignedAgent', 'firstName lastName email')
      .lean();

    if (!call) {
      return res.status(404).json({
        success: false,
        error: '通話記録が見つかりません'
      });
    }

    // 通話時間を計算
    let duration = 0;
    if (call.endTime && call.startTime) {
      duration = Math.floor((new Date(call.endTime) - new Date(call.startTime)) / 1000);
    } else if (call.duration) {
      duration = call.duration;
    }

    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;

    const formattedCall = {
      id: call._id,
      customer: call.customerId || { name: '不明', phone: call.phoneNumber || '不明' },
      date: call.createdAt,
      startTime: call.startTime,
      endTime: call.endTime,
      duration: `${minutes}分${seconds}秒`,
      durationSeconds: duration,
      status: call.status,
      result: call.callResult || '未設定',
      notes: call.notes || '',
      assignedAgent: call.assignedAgent,
      twilioCallSid: call.twilioCallSid,
      recordingUrl: call.recordingUrl,
      transcript: call.transcript || [],
      handoffDetails: call.handoffDetails,
      aiConfiguration: call.aiConfiguration
    };

    res.json({
      success: true,
      data: formattedCall
    });

  } catch (error) {
    console.error('Error fetching call details:', error);
    res.status(500).json({
      success: false,
      error: '通話詳細の取得に失敗しました'
    });
  }
});

// @desc    Update call notes/result
// @route   PUT /api/call-history/:id
// @access  Private
router.put('/:id', async (req, res) => {
  try {
    const { notes, callResult } = req.body;
    
    const updateData = {};
    if (notes !== undefined) updateData.notes = notes;
    if (callResult !== undefined) updateData.callResult = callResult;

    const call = await CallSession.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );

    if (!call) {
      return res.status(404).json({
        success: false,
        error: '通話記録が見つかりません'
      });
    }

    res.json({
      success: true,
      data: call
    });

  } catch (error) {
    console.error('Error updating call:', error);
    res.status(500).json({
      success: false,
      error: '通話記録の更新に失敗しました'
    });
  }
});

// @desc    Get call statistics
// @route   GET /api/call-history/stats/summary
// @access  Private
router.get('/stats/summary', async (req, res) => {
  try {
    const { startDate, endDate, agentId } = req.query;
    
    const query = {};
    if (agentId) query.assignedAgent = agentId;
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    // 統計情報を集計
    const stats = await CallSession.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalCalls: { $sum: 1 },
          avgDuration: { $avg: '$duration' },
          totalDuration: { $sum: '$duration' },
          successCount: {
            $sum: { $cond: [{ $eq: ['$callResult', '成功'] }, 1, 0] }
          },
          absentCount: {
            $sum: { $cond: [{ $eq: ['$callResult', '不在'] }, 1, 0] }
          },
          rejectCount: {
            $sum: { $cond: [{ $eq: ['$callResult', '拒否'] }, 1, 0] }
          },
          followUpCount: {
            $sum: { $cond: [{ $eq: ['$callResult', '要フォロー'] }, 1, 0] }
          }
        }
      }
    ]);

    // 結果別の統計
    const resultStats = await CallSession.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$callResult',
          count: { $sum: 1 },
          avgDuration: { $avg: '$duration' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        summary: stats[0] || {
          totalCalls: 0,
          avgDuration: 0,
          totalDuration: 0,
          successCount: 0,
          absentCount: 0,
          rejectCount: 0,
          followUpCount: 0
        },
        byResult: resultStats
      }
    });

  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({
      success: false,
      error: '統計情報の取得に失敗しました'
    });
  }
});

module.exports = router;