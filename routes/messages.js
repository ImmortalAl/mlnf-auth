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

// --- Eternal Feedback System ---
// Helper: Find the admin user
async function getAdminUser() {
  return await User.findOne({ role: 'admin' });
}

// Submit feedback (anonymous or identified)
router.post('/feedback', async (req, res) => {
  try {
    const { content, anonymous } = req.body;
    if (!content || typeof anonymous === 'undefined') {
      return res.status(400).json({ error: 'Content and anonymous flag required' });
    }
    const adminUser = await getAdminUser();
    if (!adminUser) {
      return res.status(500).json({ error: 'No admin user found' });
    }
    let senderId = null;
    let feedbackMeta = {};
    if (req.headers.authorization && !anonymous) {
      // Authenticated and not anonymous
      const token = req.headers.authorization.split(' ')[1];
      // Use existing auth middleware logic if possible
      // For now, fallback to user lookup by token (assume JWT)
      const jwt = require('jsonwebtoken');
      let user = null;
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        user = await User.findById(decoded.id);
      } catch (e) {}
      if (user) {
        senderId = user._id;
        feedbackMeta.username = user.username;
        feedbackMeta.displayName = user.displayName;
      }
    }
    if (!senderId) {
      // Use a special "Anonymous" system user or fallback to admin as sender
      senderId = adminUser._id;
      feedbackMeta.visitor = true;
    }
    const message = new Message({
      sender: senderId,
      recipient: adminUser._id,
      content: content.trim(),
      isFeedback: true,
      anonymous: !!anonymous,
      feedbackMeta
    });
    await message.save();
    res.status(201).json({ message: 'Feedback sent successfully', data: message });
  } catch (error) {
    console.error('Feedback submission error:', error);
    res.status(500).json({ error: 'Failed to send feedback' });
  }
});

// Admin: List all feedback messages
router.get('/feedback', authMiddleware, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const feedback = await Message.find({ isFeedback: true })
      .sort({ timestamp: -1 })
      .populate('sender', 'username displayName')
      .populate('recipient', 'username displayName');
    res.json(feedback);
  } catch (error) {
    console.error('Fetch feedback error:', error);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// Admin: Delete a feedback message
router.delete('/feedback/:id', authMiddleware, async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const { id } = req.params;
    const deleted = await Message.findOneAndDelete({ _id: id, isFeedback: true });
    if (!deleted) {
      return res.status(404).json({ error: 'Feedback not found' });
    }
    res.json({ message: 'Feedback deleted' });
  } catch (error) {
    console.error('Delete feedback error:', error);
    res.status(500).json({ error: 'Failed to delete feedback' });
  }
});

module.exports = router;