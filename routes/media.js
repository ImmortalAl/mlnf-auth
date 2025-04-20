const express = require('express');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// Fetch media
router.get('/', authMiddleware, async (req, res) => {
  try {
    const media = [];
    res.json(media);
  } catch (error) {
    console.error('Fetch media error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Upload media
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'URL required' });
    }
    const media = { id: Date.now(), url };
    res.json({ message: 'Media uploaded', media });
  } catch (error) {
    console.error('Upload media error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;