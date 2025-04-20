const express = require('express');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// Fetch mindmap
router.get('/', authMiddleware, async (req, res) => {
  try {
    const mindmap = [];
    res.json(mindmap);
  } catch (error) {
    console.error('Fetch mindmap error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update mindmap
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { node } = req.body;
    if (!node) {
      return res.status(400).json({ error: 'Node required' });
    }
    const mindmapNode = { id: Date.now(), node };
    res.json({ message: 'Mindmap updated', mindmapNode });
  } catch (error) {
    console.error('Update mindmap error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;