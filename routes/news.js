const express = require('express');
const authMiddleware = require('../middleware/auth');
const News = require('../models/News');
const router = express.Router();

// Create news story
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content required' });
    }
    const news = new News({
      title,
      content,
      author: req.user.id
    });
    await news.save();
    res.status(201).json({ message: 'News story created', news });
  } catch (error) {
    console.error('Error creating news story:', error);
    res.status(500).json({ error: 'Failed to create news story' });
  }
});

// Get all news stories
router.get('/', async (req, res) => {
  try {
    const news = await News.find().populate('author', 'username displayName').sort({ createdAt: -1 });
    res.json(news);
  } catch (error) {
    console.error('Error fetching news stories:', error);
    res.status(500).json({ error: 'Failed to fetch news stories' });
  }
});

// Update news story
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { title, content } = req.body;
    const news = await News.findById(req.params.id);
    if (!news) return res.status(404).json({ error: 'News story not found' });
    if (news.author.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    news.title = title;
    news.content = content;
    news.updatedAt = Date.now();
    await news.save();
    res.json({ message: 'News story updated', news });
  } catch (error) {
    console.error('Error updating news story:', error);
    res.status(500).json({ error: 'Failed to update news story' });
  }
});

// Delete news story
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const news = await News.findById(req.params.id);
    if (!news) return res.status(404).json({ error: 'News story not found' });
    if (news.author.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    await news.remove();
    res.json({ message: 'News story deleted' });
  } catch (error) {
    console.error('Error deleting news story:', error);
    res.status(500).json({ error: 'Failed to delete news story' });
  }
});

module.exports = router;