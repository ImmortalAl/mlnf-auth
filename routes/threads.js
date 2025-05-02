const express = require('express');
const router = express.Router();
const Thread = require('../models/Thread');
const auth = require('../middleware/auth');

// Create a new thread
router.post('/', auth, async (req, res) => {
    try {
        const { title, content, category, tags } = req.body;
        if (!title || !content || !category) {
            console.log(`Missing title, content, or category from ${req.ip}`);
            return res.status(400).json({ error: 'Title, content, and category are required' });
        }
        const thread = new Thread({
            title,
            content,
            category,
            tags: tags || [],
            author: req.user.id,
            createdAt: new Date(),
            updatedAt: new Date(),
            replies: [],
            isLocked: false
        });
        await thread.save();
        console.log(`Thread created by user ${req.user.id} from ${req.ip}: ${thread._id}`);
        res.status(201).json(thread);
    } catch (error) {
        console.error(`Error creating thread from ${req.ip}:`, error.message, error.stack);
        res.status(500).json({ error: 'Failed to create thread' });
    }
});

// Get all threads
router.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 10, category, q } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const query = {};
        if (category && category !== 'all') {
            query.category = category;
        }
        if (q) {
            query.$or = [
                { title: { $regex: q, $options: 'i' } },
                { content: { $regex: q, $options: 'i' } }
            ];
        }
        const threads = await Thread.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('author', 'username displayName avatar');
        const total = await Thread.countDocuments(query);
        console.log(`Fetched ${threads.length} threads for page ${page} from ${req.ip}`);
        res.json({
            threads,
            pagination: {
                page: parseInt(page),
                pages: Math.ceil(total / limit),
                total
            }
        });
    } catch (error) {
        console.error(`Error fetching threads from ${req.ip}:`, error.message, error.stack);
        res.status(500).json({ error: 'Failed to fetch threads' });
    }
});

module.exports = router;