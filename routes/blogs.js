const express = require('express');
const authMiddleware = require('../middleware/auth');
const router = express.Router();

// Fetch user's blogs
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const blogs = [];
    res.json(blogs);
  } catch (error) {
    console.error('Fetch blogs error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Publish blog
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content required' });
    }
    const blog = { id: Date.now(), title, content };
    res.json({ message: 'Blog published', blog });
  } catch (error) {
    console.error('Publish blog error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;