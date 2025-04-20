const express = require('express');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// Fetch messages
router.get('/', authMiddleware, async (req, res) => {
  try {
    const messages = [];
    res.json(messages);
  } catch (error) {
    console.error('Fetch messages error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Send message
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { recipient, content } = req.body;
    if (!recipient || !content) {
      return res.status(400).json({ error: 'Recipient and content required' });
    }
    const message = { id: Date.now(), recipient, content };
    res.json({ message: 'Message sent', message });
  } catch (error) {
    console.error('Send message error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;