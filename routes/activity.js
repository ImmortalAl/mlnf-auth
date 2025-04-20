const express = require('express');
const router = express.Router();

// Fetch site activity
router.get('/', async (req, res) => {
  try {
    const activities = [];
    res.json(activities);
  } catch (error) {
    console.error('Fetch activity error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;