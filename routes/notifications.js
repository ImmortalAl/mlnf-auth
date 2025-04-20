const express = require('express');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// Fetch notifications
router.get('/', authMiddleware, async (req, res) => {
  try {
    const notifications = [];
    res.json(notifications);
  } catch (error) {
    console.error('Fetch notifications error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;