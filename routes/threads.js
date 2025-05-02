const express = require('express');
const router = express.Router();
const Thread = require('../models/Thread');
const auth = require('../middleware/auth');

// Create a new thread
router.post('/', auth, async (req, res) => {
    try {
        const { title, content } = req.body;
        if (!title || !content) {
            console.log(`Missing title or content from ${req.ip}`);
            return res.status(400).json({ error: 'Title and content are required' });
        }
        const thread = new Thread({
            title,
            content,
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
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const threads = await Thread.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('author', 'username displayName avatar');
        const total = await Thread.countDocuments();
        console.log(`Fetched ${threads.length} threads for page ${page} from ${req.ip}`);
        res.json({
            threads,
            pagination: {
                page,
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