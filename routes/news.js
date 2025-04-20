const express = require('express');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// Fetch news
router.get('/', authMiddleware, async (req, res) => {
  try {
    const news = [];
    res.json(news);
  } catch (error) {
    console.error('Fetch news error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Submit news
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content required' });
    }
    const newsItem = { id: Date.now(), title, content };
    res.json({ message: 'News submitted', newsItem });
  } catch (error) {
    console.error('Submit news error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update news
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content required' });
    }
    const news = { id, title, content }; // Placeholder: Replace with MongoDB
    res.json({ message: 'News updated', news });
  } catch (error) {
    console.error('Update news error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete news
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const news = { id }; // Placeholder: Replace with MongoDB
    res.json({ message: 'News deleted' });
  } catch (error) {
    console.error('Delete news error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;