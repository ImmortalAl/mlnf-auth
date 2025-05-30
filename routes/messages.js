const express = require('express');
const authMiddleware = require('../middleware/auth');
const Message = require('../models/Message');
const User = require('../models/User');
const router = express.Router();

// Get conversation between two users
router.get('/conversation/:username', authMiddleware, async (req, res) => {
  try {
    const { username } = req.params;
    const currentUserId = req.user.id;
    
    // Find the other user
    const otherUser = await User.findOne({ username });
    if (!otherUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get messages between these two users
    const messages = await Message.find({
      $or: [
        { sender: currentUserId, recipient: otherUser._id },
        { sender: otherUser._id, recipient: currentUserId }
      ]
    })
    .populate('sender', 'username avatar')
    .populate('recipient', 'username avatar')
    .sort({ timestamp: 1 })
    .limit(100); // Limit to last 100 messages
    
    res.json(messages);
  } catch (error) {
    console.error('Fetch conversation error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Send a new message
router.post('/send', authMiddleware, async (req, res) => {
  try {
    const { recipientUsername, content } = req.body;
    const senderId = req.user.id;
    
    if (!recipientUsername || !content) {
      return res.status(400).json({ error: 'Recipient and content required' });
    }
    
    // Find recipient user
    const recipient = await User.findOne({ username: recipientUsername });
    if (!recipient) {
      return res.status(404).json({ error: 'Recipient not found' });
    }
    
    // Create new message
    const message = new Message({
      sender: senderId,
      recipient: recipient._id,
      content: content.trim()
    });
    
    await message.save();
    
    // Populate sender and recipient info for response
    await message.populate('sender', 'username avatar');
    await message.populate('recipient', 'username avatar');
    
    // Send real-time notification via WebSocket
    const wsManager = req.app.get('wsManager');
    if (wsManager) {
      wsManager.sendToUser(recipient._id.toString(), {
        type: 'newMessage',
        message: {
          _id: message._id,
          sender: message.sender,
          recipient: message.recipient,
          content: message.content,
          timestamp: message.timestamp
        }
      });
    }
    
    res.status(201).json({
      message: 'Message sent successfully',
      data: message
    });
  } catch (error) {
    console.error('Send message error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get recent conversations for a user
router.get('/conversations', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get unique conversations (latest message from each conversation)
    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [{ sender: userId }, { recipient: userId }]
        }
      },
      {
        $sort: { timestamp: -1 }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$sender', userId] },
              '$recipient',
              '$sender'
            ]
          },
          lastMessage: { $first: '$$ROOT' }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'otherUser'
        }
      },
      {
        $unwind: '$otherUser'
      },
      {
        $project: {
          otherUser: {
            _id: 1,
            username: 1,
            avatar: 1
          },
          lastMessage: 1
        }
      },
      {
        $sort: { 'lastMessage.timestamp': -1 }
      }
    ]);
    
    res.json(conversations);
  } catch (error) {
    console.error('Fetch conversations error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Send feedback (as message to admin)
router.post('/feedback', async (req, res) => {
  try {
    const { content, anonymous } = req.body;
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Feedback content is required' });
    }
    
    // Find the admin user (assuming username is 'immortalal' or similar)
    const adminUser = await User.findOne({ 
      $or: [
        { username: { $regex: /^immortalal$/i } },
        { username: { $regex: /^admin$/i } },
        { role: 'admin' }
      ]
    });
    
    if (!adminUser) {
      return res.status(500).json({ error: 'Admin user not found' });
    }
    
    let senderId = null;
    let senderInfo = null;
    
    // If not anonymous and has valid token, get user info
    if (!anonymous && token) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (user) {
          senderId = user._id;
          senderInfo = {
            username: user.username,
            displayName: user.displayName,
            avatar: user.avatar
          };
        }
      } catch (error) {
        console.log('Invalid token for feedback, treating as anonymous');
      }
    }
    
    // Create feedback message with special flag
    const feedbackMessage = new Message({
      sender: senderId, // null for anonymous
      recipient: adminUser._id,
      content: content.trim(),
      isFeedback: true,
      feedbackMetadata: {
        anonymous: anonymous || !senderId,
        timestamp: new Date(),
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        ...(senderInfo && { senderInfo })
      }
    });
    
    await feedbackMessage.save();
    
    // Populate for response (if not anonymous)
    if (senderId) {
      await feedbackMessage.populate('sender', 'username displayName avatar');
    }
    await feedbackMessage.populate('recipient', 'username displayName avatar');
    
    // Send real-time notification to admin via WebSocket
    const wsManager = req.app.get('wsManager');
    if (wsManager) {
      wsManager.sendToUser(adminUser._id.toString(), {
        type: 'newFeedback',
        message: {
          _id: feedbackMessage._id,
          sender: feedbackMessage.sender,
          recipient: feedbackMessage.recipient,
          content: feedbackMessage.content,
          timestamp: feedbackMessage.timestamp,
          isFeedback: true,
          anonymous: feedbackMessage.feedbackMetadata.anonymous
        }
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Feedback sent successfully',
      feedbackId: feedbackMessage._id 
    });
    
  } catch (error) {
    console.error('Feedback submission error:', error);
    res.status(500).json({ error: 'Failed to send feedback' });
  }
});

// Get all feedback messages (admin only)
router.get('/feedback', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    const user = await User.findById(req.user.id);
    if (!user || (user.username.toLowerCase() !== 'immortalal' && user.role !== 'admin')) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    
    // Get feedback messages
    const feedbackMessages = await Message.find({ 
      isFeedback: true,
      recipient: req.user.id 
    })
    .populate('sender', 'username displayName avatar')
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(limit);
    
    const total = await Message.countDocuments({ 
      isFeedback: true,
      recipient: req.user.id 
    });
    
    res.json({
      feedback: feedbackMessages,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Get feedback error:', error);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

module.exports = router;