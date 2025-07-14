const express = require('express');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// Debug endpoint to check auth status
router.get('/whoami', authMiddleware, async (req, res) => {
  try {
    res.json({
      userId: req.user._id,
      username: req.user.username,
      role: req.user.role,
      isAdmin: req.user.role === 'admin',
      tokenValid: true
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

module.exports = router;