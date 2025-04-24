const express = require('express');
const router = express.Router();
const Blog = require('../models/Blog');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Create a new blog post
router.post('/', auth, async (req, res) => {
    const { title, content } = req.body;

    if (!title || !content) {
        return res.status(400).json({ error: 'Title and content are required' });
    }

    try {
        const blog = new Blog({
            title,
            content,
            author: req.user.id
        });
        await blog.save();
        const populatedBlog = await Blog.findById(blog._id).populate('author', 'username displayName avatar');
        res.status(201).json(populatedBlog);
    } catch (error) {
        console.error('Error creating blog post:', error);
        res.status(500).json({ error: 'Failed to create blog post' });
    }
});

// Get all blog posts
router.get('/', async (req, res) => {
    try {
        const blogs = await Blog.find()
            .populate('author', 'username displayName avatar')
            .sort({ createdAt: -1 });
        res.json(blogs);
    } catch (error) {
        console.error('Error fetching blogs:', error);
        res.status(500).json({ error: 'Failed to fetch blog posts' });
    }
});

// Get user's blog posts
router.get('/my', auth, async (req, res) => {
    try {
        const blogs = await Blog.find({ author: req.user.id })
            .populate('author', 'username displayName avatar')
            .sort({ createdAt: -1 });
        res.json(blogs);
    } catch (error) {
        console.error('Error fetching user blogs:', error);
        res.status(500).json({ error: 'Failed to fetch your blog posts' });
    }
});

module.exports = router;