const express = require('express');
const router = express.Router();
const Blog = require('../models/Blog');
const auth = require('../middleware/auth');
const User = require('../models/User');

// Test endpoint to verify router mounting
router.get('/test', (req, res) => res.json({ message: 'Blogs router is working' }));

// Create a new blog post
router.post('/', auth, async (req, res) => {
    const { title, content, status } = req.body;

    if (!title || !content) {
        return res.status(400).json({ error: 'Title and content are required' });
    }

    try {
        const blog = new Blog({
            title,
            content,
            author: req.user.id,
            status: status || 'published'
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
        
        // Build query filter to show published posts and legacy posts without a status
        const filter = {
            $or: [
                { status: 'published' },
                { status: { $exists: false } } // For backward compatibility
            ]
        };

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
        const filter = { author: req.user.id };
        
        // Allow filtering by status (published, draft, or all)
        if (req.query.status && req.query.status !== 'all') {
            filter.status = req.query.status;
        }
        
        const blogs = await Blog.find(filter)
            .populate('author', 'username displayName avatar')
            .sort({ createdAt: -1 });
        res.json(blogs);
    } catch (error) {
        console.error('Error fetching user blogs:', error);
        res.status(500).json({ error: 'Failed to fetch your blog posts' });
    }
});

// Get user's drafts specifically
router.get('/my/drafts', auth, async (req, res) => {
    try {
        const drafts = await Blog.find({ 
            author: req.user.id, 
            status: 'draft' 
        })
            .populate('author', 'username displayName avatar')
            .sort({ updatedAt: -1 });
        res.json(drafts);
    } catch (error) {
        console.error('Error fetching user drafts:', error);
        res.status(500).json({ error: 'Failed to fetch your drafts' });
    }
});

// Get user's blog posts by username
router.get('/user/:username', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const blogs = await Blog.find({ 
            author: user._id,
            $or: [
                { status: 'published' },
                { status: { $exists: false } } // For backward compatibility
            ]
        })
            .populate('author', 'username displayName avatar')
            .sort({ createdAt: -1 });
            
        res.json(blogs);
    } catch (error) {
        console.error('Error fetching user blogs by username:', error);
        res.status(500).json({ error: 'Failed to fetch user blog posts' });
    }
});

// Update a blog post (for editing drafts or publishing)
router.put('/:id', auth, async (req, res) => {
    try {
        const { title, content, status } = req.body;
        
        const blog = await Blog.findById(req.params.id);
        if (!blog) {
            return res.status(404).json({ error: 'Blog post not found' });
        }
        
        // Check if user owns this blog post
        if (blog.author.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized to edit this post' });
        }
        
        // Update fields
        if (title) blog.title = title;
        if (content) blog.content = content;
        if (status) blog.status = status;
        
        await blog.save();
        
        const updatedBlog = await Blog.findById(blog._id)
            .populate('author', 'username displayName avatar');
        
        res.json(updatedBlog);
    } catch (error) {
        console.error('Error updating blog post:', error);
        if (error.kind === 'ObjectId') {
            return res.status(404).json({ error: 'Invalid blog post ID' });
        }
        res.status(500).json({ error: 'Failed to update blog post' });
    }
});

// Delete a blog post
router.delete('/:id', auth, async (req, res) => {
    try {
        const blog = await Blog.findById(req.params.id);
        if (!blog) {
            return res.status(404).json({ error: 'Blog post not found' });
        }
        
        // Check if user owns this blog post
        if (blog.author.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized to delete this post' });
        }
        
        await Blog.findByIdAndDelete(req.params.id);
        res.json({ message: 'Blog post deleted successfully' });
    } catch (error) {
        console.error('Error deleting blog post:', error);
        if (error.kind === 'ObjectId') {
            return res.status(404).json({ error: 'Invalid blog post ID' });
        }
        res.status(500).json({ error: 'Failed to delete blog post' });
    }
});

// Like a blog post
router.post('/:id/like', auth, async (req, res) => {
    try {
        const blog = await Blog.findById(req.params.id);
        if (!blog) {
            return res.status(404).json({ error: 'Blog post not found' });
        }
        
        const userId = req.user.id;
        
        // Remove from dislikes if present
        blog.dislikes = blog.dislikes.filter(id => id.toString() !== userId);
        
        // Toggle like
        const likeIndex = blog.likes.findIndex(id => id.toString() === userId);
        if (likeIndex > -1) {
            // Already liked, remove like
            blog.likes.splice(likeIndex, 1);
        } else {
            // Not liked, add like
            blog.likes.push(userId);
        }
        
        await blog.save();
        
        res.json({
            likes: blog.likes.length,
            dislikes: blog.dislikes.length,
            userLiked: blog.likes.some(id => id.toString() === userId),
            userDisliked: blog.dislikes.some(id => id.toString() === userId)
        });
    } catch (error) {
        console.error('Error liking blog post:', error);
        if (error.kind === 'ObjectId') {
            return res.status(404).json({ error: 'Invalid blog post ID' });
        }
        res.status(500).json({ error: 'Failed to like blog post' });
    }
});

// Dislike a blog post
router.post('/:id/dislike', auth, async (req, res) => {
    try {
        const blog = await Blog.findById(req.params.id);
        if (!blog) {
            return res.status(404).json({ error: 'Blog post not found' });
        }
        
        const userId = req.user.id;
        
        // Remove from likes if present
        blog.likes = blog.likes.filter(id => id.toString() !== userId);
        
        // Toggle dislike
        const dislikeIndex = blog.dislikes.findIndex(id => id.toString() === userId);
        if (dislikeIndex > -1) {
            // Already disliked, remove dislike
            blog.dislikes.splice(dislikeIndex, 1);
        } else {
            // Not disliked, add dislike
            blog.dislikes.push(userId);
        }
        
        await blog.save();
        
        res.json({
            likes: blog.likes.length,
            dislikes: blog.dislikes.length,
            userLiked: blog.likes.some(id => id.toString() === userId),
            userDisliked: blog.dislikes.some(id => id.toString() === userId)
        });
    } catch (error) {
        console.error('Error disliking blog post:', error);
        if (error.kind === 'ObjectId') {
            return res.status(404).json({ error: 'Invalid blog post ID' });
        }
        res.status(500).json({ error: 'Failed to dislike blog post' });
    }
});

module.exports = router;