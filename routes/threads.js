const express = require('express');
const router = express.Router();
const Thread = require('../models/Thread');
const auth = require('../middleware/auth');

// Create a new thread
router.post('/', auth, async (req, res) => {
    try {
        const { title, content, category, tags, isAnonymous } = req.body;
        
        // Debug logging
        console.log(`[THREAD CREATE] User: ${req.user.id}, IP: ${req.ip}`);
        console.log(`[THREAD CREATE] Request body:`, {
            title: title ? title.substring(0, 50) + '...' : 'MISSING',
            content: content ? `${content.length} chars` : 'MISSING',
            category: category || 'MISSING',
            tags: tags || 'none',
            isAnonymous: !!isAnonymous
        });
        
        if (!title || !content || !category) {
            console.log(`[THREAD CREATE] Missing required fields from ${req.ip}`);
            return res.status(400).json({ error: 'Title, content, and category are required' });
        }

        // Generate anonymous display name if posting anonymously
        let anonymousDisplayName = null;
        if (isAnonymous) {
            anonymousDisplayName = generateAnonymousName();
        }

        const thread = new Thread({
            title,
            content,
            category,
            tags: tags || [],
            author: req.user.id,
            isAnonymous: !!isAnonymous,
            anonymousDisplayName,
            createdAt: new Date(),
            updatedAt: new Date(),
            replies: [],
            isLocked: false
        });
        await thread.save();
        
        console.log(`[THREAD CREATE] SUCCESS: User ${req.user.id} from ${req.ip}: ${thread._id} (Anonymous: ${!!isAnonymous})`);
        res.status(201).json(thread);
    } catch (error) {
        console.error(`[THREAD CREATE] ERROR from ${req.ip}:`, error.message);
        console.error(`[THREAD CREATE] Stack:`, error.stack);
        console.error(`[THREAD CREATE] Full error:`, error);
        res.status(500).json({ error: 'Failed to create thread' });
    }
});

// Helper function to generate anonymous display names
function generateAnonymousName() {
    const adjectives = [
        'Eternal', 'Mystic', 'Ancient', 'Wise', 'Noble', 'Silent', 'Hidden',
        'Timeless', 'Immortal', 'Celestial', 'Profound', 'Sacred', 'Enigmatic'
    ];
    
    const nouns = [
        'Seeker', 'Scholar', 'Wanderer', 'Guardian', 'Sage', 'Observer',
        'Keeper', 'Whisper', 'Soul', 'Spirit', 'Flame', 'Shadow', 'Star'
    ];

    const adjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    
    return `${adjective} ${noun}`;
}

// Get all threads
router.get('/', async (req, res) => {
    console.log(`[DEBUG] GET /threads request from ${req.ip}`);
    console.log(`[DEBUG] Request headers:`, req.headers);
    console.log(`[DEBUG] Query params:`, req.query);
    
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
        
        console.log(`[DEBUG] MongoDB query:`, query);
        
        const threads = await Thread.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('author', 'username displayName avatar');

        // Process threads to handle anonymous display
        const processedThreads = threads.map(thread => {
            const threadObj = thread.toObject();
            if (threadObj.isAnonymous) {
                threadObj.author = {
                    username: threadObj.anonymousDisplayName || 'Anonymous Seeker',
                    displayName: threadObj.anonymousDisplayName || 'Anonymous Seeker',
                    avatar: null,
                    isAnonymous: true
                };
            }
            return threadObj;
        });
        const total = await Thread.countDocuments(query);
        
        console.log(`[DEBUG] Fetched ${threads.length} threads for page ${page} from ${req.ip}`);
        console.log(`[DEBUG] Sending response:`, {
            threadsCount: threads.length,
            pagination: {
                page: parseInt(page),
                pages: Math.ceil(total / limit),
                total
            }
        });
        
        res.json({
            threads: processedThreads,
            pagination: {
                page: parseInt(page),
                pages: Math.ceil(total / limit),
                total
            }
        });
    } catch (error) {
        console.error(`[ERROR] Error fetching threads from ${req.ip}:`, error.message, error.stack);
        res.status(500).json({ error: 'Failed to fetch threads' });
    }
});

// Get a single thread by ID
router.get('/:id', async (req, res) => {
    console.log(`[DEBUG] GET /threads/${req.params.id} request from ${req.ip}`);
    console.log(`[DEBUG] Thread ID received:`, req.params.id);
    
    try {
        // Validate ObjectId format
        if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
            console.log(`[DEBUG] Invalid ObjectId format: ${req.params.id} from ${req.ip}`);
            return res.status(400).json({ error: 'Invalid thread ID format' });
        }

        const thread = await Thread.findById(req.params.id)
            .populate('author', 'username displayName avatar signature')
            .populate('replies.author', 'username displayName avatar signature');
        
        console.log(`[DEBUG] Database query result for ${req.params.id}:`, thread ? 'Found' : 'Not found');
        
        if (!thread) {
            console.log(`[DEBUG] Thread not found: ${req.params.id} from ${req.ip}`);
            return res.status(404).json({ error: 'Thread not found' });
        }

        // Process thread to handle anonymous display
        const threadObj = thread.toObject();
        
        // Handle anonymous thread author
        if (threadObj.isAnonymous) {
            threadObj.author = {
                username: threadObj.anonymousDisplayName || 'Anonymous Seeker',
                displayName: threadObj.anonymousDisplayName || 'Anonymous Seeker',
                avatar: null,
                signature: null,
                isAnonymous: true
            };
        }

        // Handle anonymous replies
        if (threadObj.replies) {
            threadObj.replies = threadObj.replies.map(reply => {
                if (reply.isAnonymous) {
                    reply.author = {
                        username: reply.anonymousDisplayName || 'Anonymous Seeker',
                        displayName: reply.anonymousDisplayName || 'Anonymous Seeker',
                        avatar: null,
                        signature: null,
                        isAnonymous: true
                    };
                }
                return reply;
            });
        }

        console.log(`[DEBUG] Successfully fetched and processed thread ${req.params.id} from ${req.ip}`);
        console.log(`[DEBUG] Thread has ${threadObj.replies ? threadObj.replies.length : 0} replies`);
        res.json(threadObj);
    } catch (error) {
        console.error(`[ERROR] Error fetching thread ${req.params.id} from ${req.ip}:`, error.message);
        console.error(`[ERROR] Full error details:`, error);
        res.status(500).json({ error: 'Failed to fetch thread', details: error.message });
    }
});

// Add a reply to a thread
router.post('/:id/replies', auth, async (req, res) => {
    try {
        const { content, isAnonymous } = req.body;
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

        // Generate anonymous display name if replying anonymously
        let anonymousDisplayName = null;
        if (isAnonymous) {
            anonymousDisplayName = generateAnonymousName();
        }

        const reply = {
            content,
            author: req.user.id,
            isAnonymous: !!isAnonymous,
            anonymousDisplayName,
            createdAt: new Date()
        };

        thread.replies.push(reply);
        thread.updatedAt = new Date();
        await thread.save();

        console.log(`Reply added to thread ${req.params.id} by user ${req.user.id} from ${req.ip} (Anonymous: ${!!isAnonymous})`);
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

// Edit a reply
router.put('/:threadId/replies/:replyId', auth, async (req, res) => {
    try {
        const { content } = req.body;
        const { threadId, replyId } = req.params;

        if (!content || content.trim().length === 0) {
            return res.status(400).json({ error: 'Reply content is required' });
        }

        const thread = await Thread.findById(threadId);
        if (!thread) {
            return res.status(404).json({ error: 'Thread not found' });
        }

        // Find the reply to edit
        const replyIndex = thread.replies.findIndex(reply => reply._id.toString() === replyId);
        if (replyIndex === -1) {
            return res.status(404).json({ error: 'Reply not found' });
        }

        const reply = thread.replies[replyIndex];

        // Check if user is the author
        if (reply.author.toString() !== req.user.id) {
            return res.status(403).json({ error: 'You are not authorized to edit this reply' });
        }

        // Check if reply is anonymous (cannot edit anonymous replies)
        if (reply.isAnonymous) {
            return res.status(403).json({ error: 'Anonymous replies cannot be edited' });
        }

        // Check if there are any replies after this one (prevent editing if others have replied)
        const hasSubsequentReplies = thread.replies.slice(replyIndex + 1).length > 0;
        if (hasSubsequentReplies) {
            return res.status(403).json({ error: 'Cannot edit reply: other users have already responded' });
        }

        // Store original content in edit history
        if (!reply.editHistory) {
            reply.editHistory = [];
        }
        
        reply.editHistory.push({
            editedAt: new Date(),
            originalContent: reply.content
        });

        // Update the reply
        reply.content = content.trim();
        reply.editedAt = new Date();
        thread.updatedAt = new Date();

        await thread.save();

        console.log(`Reply ${replyId} edited by user ${req.user.id} from ${req.ip}`);
        res.json({ 
            message: 'Reply updated successfully', 
            reply: {
                _id: reply._id,
                content: reply.content,
                editedAt: reply.editedAt,
                editHistory: reply.editHistory
            }
        });

    } catch (error) {
        console.error(`Error editing reply ${req.params.replyId} from ${req.ip}:`, error.message, error.stack);
        res.status(500).json({ error: 'Failed to edit reply' });
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