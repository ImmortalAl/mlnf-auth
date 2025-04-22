const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Blog = require('../models/Blog');

// Create a blog post
router.post('/', auth, async (req, res) => {
    try {
        console.log('POST /api/blogs - User ID:', req.user.id);
        console.log('Request body:', req.body);
        const { title, content } = req.body;
        if (!title || !content) {
            return res.status(400).json({ error: 'Title and content are required' });
        }
        const blog = new Blog({
            title,
            content,
            author: req.user.id
        });
        await blog.save();
        console.log('Blog created:', blog);
        res.status(201).json(blog);
    } catch (error) {
        console.error('Create blog error:', error);
        res.status(500).json({ error: `Server error: ${error.message}` });
    }
});

// Get user's blogs
router.get('/my', auth, async (req, res) => {
    try {
        console.log('GET /api/blogs/my - User ID:', req.user.id);
        const blogs = await Blog.find({ author: req.user.id }).sort({ createdAt: -1 });
        console.log('User blogs:', blogs.length);
        res.json(blogs);
    } catch (error) {
        console.error('Get user blogs error:', error);
        res.status(500).json({ error: `Server error: ${error.message}` });
    }
});

module.exports = router;