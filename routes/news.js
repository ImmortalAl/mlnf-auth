const express = require('express');
const authMiddleware = require('../middleware/auth');
const News = require('../models/News');
const router = express.Router();

// Fetch news
router.get('/', authMiddleware, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const skip = (page - 1) * limit;

    const totalNews = await News.countDocuments();
    const totalPages = Math.ceil(totalNews / limit);

    const news = await News.find()
      .populate('author', 'username displayName avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      docs: news,
      totalDocs: totalNews,
      totalPages: totalPages,
      page: page,
      limit: limit
    });
  } catch (error) {
    console.error('Fetch news error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get a single news item by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const newsItem = await News.findById(req.params.id).populate('author', 'username displayName avatar');
    
    if (!newsItem) {
      return res.status(404).json({ error: 'News item not found' });
    }
    
    res.json(newsItem);
  } catch (error) {
    console.error('Fetch news item error:', error.message);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ error: 'Invalid news ID' });
    }
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
    
    const newsItem = new News({
      title,
      content,
      author: req.user.id
    });
    
    await newsItem.save();
    const populatedNewsItem = await News.findById(newsItem._id).populate('author', 'username displayName avatar');
    res.status(201).json(populatedNewsItem);
  } catch (error) {
    console.error('Submit news error:', error.message);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
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
    
    const newsItem = await News.findById(id);
    
    if (!newsItem) {
      return res.status(404).json({ error: 'News item not found' });
    }
    
    // Check if the user is the author of the news item
    if (newsItem.author.toString() !== req.user.id) {
      return res.status(403).json({ error: 'You can only edit your own news items' });
    }
    
    newsItem.title = title;
    newsItem.content = content;
    newsItem.updatedAt = new Date();
    
    await newsItem.save();
    const populatedNewsItem = await News.findById(newsItem._id).populate('author', 'username displayName avatar');
    res.json(populatedNewsItem);
  } catch (error) {
    console.error('Update news error:', error.message);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ error: 'Invalid news ID' });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete news
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const newsItem = await News.findById(id);
    
    if (!newsItem) {
      return res.status(404).json({ error: 'News item not found' });
    }
    
    // Check if the user is the author of the news item
    if (newsItem.author.toString() !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete your own news items' });
    }
    
    await News.findByIdAndDelete(id);
    res.json({ message: 'News item deleted successfully' });
  } catch (error) {
    console.error('Delete news error:', error.message);
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ error: 'Invalid news ID' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;