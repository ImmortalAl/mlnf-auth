const express = require('express');
const router = express.Router();
const Thread = require('../models/Thread');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Create a new thread
router.post('/', auth, async (req, res) => {
    const { title, content, category, tags } = req.body;

    if (!title || !content || !category) {
        console.log(`Missing required fields from ${req.ip}`);
        return res.status(400).json({ error: 'Title, content, and category are required' });
    }

    try {
        const validCategories = ['Ideas', 'Debates', 'Trades', 'Events', 'Governance'];
        if (!validCategories.includes(category)) {
            console.log(`Invalid category: ${category} from ${req.ip}`);
            return res.status(400).json({ error: 'Invalid category' });
        }

        const thread = new Thread({
            title,
            content,
            category,
            tags: tags ? tags.filter(tag => tag && tag.length <= 30).slice(0, 10) : [],
            author: req.user.id
        });

        await thread.save();
        const populatedThread = await Thread.findById(thread._id)
            .populate('author', 'username displayName avatar');
        console.log(`Thread created by ${req.user.id} from ${req.ip}: ${thread._id}`);
        res.status(201).json(populatedThread);
    } catch (error) {
        console.error(`Error creating thread for ${req.user.id} from ${req.ip}:`, error.message, error.stack);
        res.status(500).json({ error: 'Failed to create thread' });
    }
});

// Get all threads
router.get('/', async (req, res) => {
    const { category, q = '', page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    try {
        let query = {};
        if (category) query.category = category;
        if (q) {
            query.$or = [
                { title: { $regex: q, $options: 'i' } },
                { content: { $regex: q, $options: 'i' } },
                { tags: { $regex: q, $options: 'i' } }
            ];
        }
        query.hidden = false;

        const threads = await Thread.find(query)
            .populate('author', 'username displayName avatar')
            .populate('replies.author', 'username displayName avatar')
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 });

        const total = await Thread.countDocuments(query);

        console.log(`Fetched ${threads.length} threads (page ${page}, limit ${limit}, query: ${q}, category: ${category}) from ${req.ip}`);
        res.json({
            threads,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error(`Error fetching threads from ${req.ip}:`, error.message, error.stack);
        res.status(500).json({ error: 'Failed to fetch threads' });
    }
});

// Get a single thread
router.get('/:id', async (req, res) => {
    try {
        const thread = await Thread.findById(req.params.id)
            .populate('author', 'username displayName avatar')
            .populate('replies.author', 'username displayName avatar');
        if (!thread || thread.hidden) {
            console.log(`Thread not found or hidden: ${req.params.id} from ${req.ip}`);
            return res.status(404).json({ error: 'Thread not found' });
        }
        console.log(`Fetched thread ${req.params.id} from ${req.ip}`);
        res.json(thread);
    } catch (error) {
        console.error(`Error fetching thread ${req.params.id} from ${req.ip}:`, error.message, error.stack);
        res.status(500).json({ error: 'Failed to fetch thread' });
    }
});

// Post a reply to a thread
router.post('/:id/replies', auth, async (req, res) => {
    const { content } = req.body;

    if (!content) {
        console.log(`Missing content for reply from ${req.ip}`);
        return res.status(400).json({ error: 'Content is required' });
    }

    try {
        const thread = await Thread.findById(req.params.id);
        if (!thread || thread.hidden) {
            console.log(`Thread not found or hidden: ${req.params.id} from ${req.ip}`);
            return res.status(404).json({ error: 'Thread not found' });
        }

        thread.replies.push({
            content,
            author: req.user.id
        });

        await thread.save();
        const populatedThread = await Thread.findById(req.params.id)
            .populate('author', 'username displayName avatar')
            .populate('replies.author', 'username displayName avatar');
        console.log(`Reply added to thread ${req.params.id} by ${req.user.id} from ${req.ip}`);
        res.status(201).json(populatedThread.replies[populatedThread.replies.length - 1]);
    } catch (error) {
        console.error(`Error adding reply to thread ${req.params.id} from ${req.ip}:`, error.message, error.stack);
        res.status(500).json({ error: 'Failed to post reply' });
    }
});

module.exports = router;