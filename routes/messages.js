const express = require('express');
const authMiddleware = require('../middleware/auth');
const Message = require('../models/Message');
const User = require('../models/User');
const router = express.Router();

// Get online users
router.get('/online', authMiddleware, async (req, res) => {
  try {
    console.log(`Fetching online users for ${req.user.username}`);
    const users = await User.find({ status: 'Online' }).select('username status avatar');
    res.json(users);
  } catch (error) {
    console.error('Error fetching online users:', error);
    res.status(500).json({ error: 'Failed to fetch online users' });
  }
});

// Send message
router.post('/send', authMiddleware, async (req, res) => {
  const { recipient, message } = req.body;
  if (!recipient || !message) {
    return res.status(400).json({ error: 'Recipient and message required' });
  }
  try {
    const recipientUser = await User.findOne({ username: recipient });
    if (!recipientUser) {
      return res.status(404).json({ error: 'Recipient not found' });
    }
    const newMessage = new Message({
      sender: req.user.username,
      recipient,
      message
    });
    await newMessage.save();
    res.json({ success: true, messageId: newMessage._id });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Get message history
router.get('/history', authMiddleware, async (req, res) => {
  const { recipient } = req.query;
  if (!recipient) {
    return res.status(400).json({ error: 'Recipient required' });
  }
  try {
    const messages = await Message.find({
      $or: [
        { sender: req.user.username, recipient },
        { sender: recipient, recipient: req.user.username }
      ]
    }).sort({ timestamp: 1 });
    res.json(messages.map(msg => ({
      sender: msg.sender,
      message: msg.message,
      timestamp: msg.timestamp.toISOString()
    })));
  } catch (error) {
    console.error('Error fetching message history:', error);
    res.status(500).json({ error: 'Failed to fetch message history' });
  }
});

module.exports = router;