const express = require('express');
const authMiddleware = require('../middleware/auth');
const Blog = require('../models/Blog');
const router = express.Router();

// Create blog post
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content required' });
    }
    const blog = new Blog({
      title,
      content,
      author: req.user.id
    });
    await blog.save();
    res.status(201).json({ message: 'Blog post created', blog });
  } catch (error) {
    console.error('Error creating blog post:', error);
    res.status(500).json({ error: 'Failed to create blog post' });
  }
});

// Get all blog posts
router.get('/', async (req, res) => {
  try {
    const blogs = await Blog.find().populate('author', 'username displayName').sort({ createdAt: -1 });
    res.json(blogs);
  } catch (error) {
    console.error('Error fetching blog posts:', error);
    res.status(500).json({ error: 'Failed to fetch blog posts' });
  }
});

// Update blog post
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { title, content } = req.body;
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ error: 'Blog post not found' });
    if (blog.author.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    blog.title = title;
    blog.content = content;
    blog.updatedAt = Date.now();
    await blog.save();
    res.json({ message: 'Blog post updated', blog });
  } catch (error) {
    console.error('Error updating blog post:', error);
    res.status(500).json({ error: 'Failed to update blog post' });
  }
});

// Delete blog post
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ error: 'Blog post not found' });
    if (blog.author.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    await blog.remove();
    res.json({ message: 'Blog post deleted' });
  } catch (error) {
    console.error('Error deleting blog post:', error);
    res.status(500).json({ error: 'Failed to delete blog post' });
  }
});

module.exports = router;