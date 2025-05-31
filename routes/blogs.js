const express = require('express');
const router = express.Router();
const Blog = require('../models/Blog');
const auth = require('../middleware/auth');

// Test endpoint to verify router mounting
router.get('/test', (req, res) => res.json({ message: 'Blogs router is working' }));

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

// Get all blog posts with pagination
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        
        // Build query filter
        const filter = {};
        if (req.query.author) {
            filter.author = req.query.author;
        }

        const totalBlogs = await Blog.countDocuments(filter);
        const totalPages = Math.ceil(totalBlogs / limit);
        
        const blogs = await Blog.find(filter)
            .populate('author', 'username displayName avatar')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        // Return paginated response
        res.json({
            docs: blogs,
            totalDocs: totalBlogs,
            totalPages: totalPages,
            page: page,
            limit: limit,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
            nextPage: page < totalPages ? page + 1 : null,
            prevPage: page > 1 ? page - 1 : null
        });
    } catch (error) {
        console.error('Error fetching blogs:', error);
        res.status(500).json({ error: 'Failed to fetch blog posts' });
    }
});

// Get a single blog post by ID
router.get('/:id', async (req, res) => {
    try {
        const blog = await Blog.findById(req.params.id)
            .populate('author', 'username displayName avatar');
        
        if (!blog) {
            return res.status(404).json({ error: 'Blog post not found' });
        }
        
        res.json(blog);
    } catch (error) {
        console.error('Error fetching blog post:', error);
        if (error.kind === 'ObjectId') {
            return res.status(404).json({ error: 'Invalid blog post ID' });
        }
        res.status(500).json({ error: 'Failed to fetch blog post' });
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