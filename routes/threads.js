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

// Get a single thread by ID
router.get('/:id', async (req, res) => {
    try {
        const thread = await Thread.findById(req.params.id)
            .populate('author', 'username displayName avatar signature')
            .populate('replies.author', 'username displayName avatar signature');
        
        if (!thread) {
            console.log(`Thread not found: ${req.params.id} from ${req.ip}`);
            return res.status(404).json({ error: 'Thread not found' });
        }

        console.log(`Fetched thread ${req.params.id} from ${req.ip}`);
        res.json(thread);
    } catch (error) {
        console.error(`Error fetching thread ${req.params.id} from ${req.ip}:`, error.message, error.stack);
        res.status(500).json({ error: 'Failed to fetch thread' });
    }
});

// Add a reply to a thread
router.post('/:id/replies', auth, async (req, res) => {
    try {
        const { content } = req.body;
        if (!content) {
            return res.status(400).json({ error: 'Reply content is required' });
        }

        const thread = await Thread.findById(req.params.id);
        if (!thread) {
            return res.status(404).json({ error: 'Thread not found' });
        }

        if (thread.isLocked) {
            return res.status(403).json({ error: 'Thread is locked' });
        }

        const reply = {
            content,
            author: req.user.id,
            createdAt: new Date()
        };

        thread.replies.push(reply);
        thread.updatedAt = new Date();
        await thread.save();

        console.log(`Reply added to thread ${req.params.id} by user ${req.user.id} from ${req.ip}`);
        res.status(201).json({ message: 'Reply added successfully', reply });
    } catch (error) {
        console.error(`Error adding reply to thread ${req.params.id} from ${req.ip}:`, error.message, error.stack);
        res.status(500).json({ error: 'Failed to add reply' });
    }
});

// Vote on a thread (placeholder - for now just returns success)
router.post('/:id/vote', auth, async (req, res) => {
    try {
        const { vote } = req.body; // 'upvote' or 'downvote'
        
        // TODO: Implement actual voting logic with user tracking
        // For now, just return a mock response
        const newScore = Math.floor(Math.random() * 20) - 5; // Random score for demo
        
        console.log(`Vote ${vote} on thread ${req.params.id} by user ${req.user.id} from ${req.ip}`);
        res.json({ message: 'Vote recorded', newScore });
    } catch (error) {
        console.error(`Error voting on thread ${req.params.id} from ${req.ip}:`, error.message, error.stack);
        res.status(500).json({ error: 'Failed to record vote' });
    }
});

// Vote on a reply (placeholder - for now just returns success)
router.post('/:threadId/replies/:replyId/vote', auth, async (req, res) => {
    try {
        const { vote } = req.body; // 'upvote' or 'downvote'
        
        // TODO: Implement actual voting logic with user tracking
        // For now, just return a mock response
        const newScore = Math.floor(Math.random() * 15) - 3; // Random score for demo
        
        console.log(`Vote ${vote} on reply ${req.params.replyId} by user ${req.user.id} from ${req.ip}`);
        res.json({ message: 'Vote recorded', newScore });
    } catch (error) {
        console.error(`Error voting on reply ${req.params.replyId} from ${req.ip}:`, error.message, error.stack);
        res.status(500).json({ error: 'Failed to record vote' });
    }
});

// Update a thread
router.put('/:id', auth, async (req, res) => {
    try {
        const { title, content, category, tags } = req.body;
        const thread = await Thread.findById(req.params.id);

        if (!thread) {
            return res.status(404).json({ error: 'Thread not found' });
        }

        // Ensure the user is the author
        if (thread.author.toString() !== req.user.id) {
            return res.status(403).json({ error: 'You are not authorized to edit this thread' });
        }

        // Update fields
        thread.title = title || thread.title;
        thread.content = content || thread.content;
        thread.category = category || thread.category;
        thread.tags = tags || thread.tags;
        thread.updatedAt = Date.now();

        await thread.save();

        const updatedThread = await Thread.findById(thread._id)
            .populate('author', 'username displayName avatar');

        res.json(updatedThread);
    } catch (error) {
        console.error('Error updating thread:', error);
        res.status(500).json({ error: 'Failed to update thread' });
    }
});

module.exports = router;