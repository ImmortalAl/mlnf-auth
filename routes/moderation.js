const express = require('express');
const router = express.Router();
const Thread = require('../models/Thread');
const Moderation = require('../models/Moderation');
const auth = require('../middleware/auth');

// Flag a thread for moderation
router.post('/flags', auth, async (req, res) => {
    const { threadId } = req.body;

    if (!threadId) {
        console.log(`Missing threadId for flag from ${req.ip}`);
        return res.status(400).json({ error: 'Thread ID is required' });
    }

    try {
        const thread = await Thread.findById(threadId);
        if (!thread || thread.hidden) {
            console.log(`Thread not found or hidden: ${threadId} from ${req.ip}`);
            return res.status(404).json({ error: 'Thread not found' });
        }

        let moderation = await Moderation.findOne({ threadId });
        if (!moderation) {
            moderation = new Moderation({
                threadId,
                flags: [{ userId: req.user.id, createdAt: new Date() }],
                votes: []
            });
        } else {
            if (moderation.flags.some(flag => flag.userId.toString() === req.user.id)) {
                console.log(`User ${req.user.id} already flagged thread ${threadId} from ${req.ip}`);
                return res.status(400).json({ error: 'You have already flagged this thread' });
            }
            moderation.flags.push({ userId: req.user.id, createdAt: new Date() });
        }

        // Auto-hide after 5 flags
        if (moderation.flags.length >= 5 && !thread.hidden) {
            thread.hidden = true;
            await thread.save();
            moderation.status = 'pending';
        }

        await moderation.save();
        console.log(`Thread ${threadId} flagged by ${req.user.id} from ${req.ip}. Total flags: ${moderation.flags.length}`);
        res.status(201).json({ message: 'Thread flagged for community review' });
    } catch (error) {
        console.error(`Error flagging thread ${threadId} from ${req.ip}:`, error.message, error.stack);
        res.status(500).json({ error: 'Failed to flag thread' });
    }
});

// Vote on a moderation action
router.post('/votes', auth, async (req, res) => {
    const { threadId, action } = req.body; // action: 'delete', 'hide', 'ban'

    if (!threadId || !action) {
        console.log(`Missing threadId or action for vote from ${req.ip}`);
        return res.status(400).json({ error: 'Thread ID and action are required' });
    }

    const validActions = ['delete', 'hide', 'ban'];
    if (!validActions.includes(action)) {
        console.log(`Invalid action: ${action} from ${req.ip}`);
        return res.status(400).json({ error: 'Invalid action' });
    }

    try {
        const moderation = await Moderation.findOne({ threadId });
        if (!moderation) {
            console.log(`No moderation record for thread ${threadId} from ${req.ip}`);
            return res.status(404).json({ error: 'No moderation record found' });
        }

        if (moderation.votes.some(vote => vote.userId.toString() === req.user.id)) {
            console.log(`User ${req.user.id} already voted on thread ${threadId} from ${req.ip}`);
            return res.status(400).json({ error: 'You have already voted' });
        }

        moderation.votes.push({ userId: req.user.id, action, createdAt: new Date() });
        await moderation.save();

        // Calculate vote outcome
        const totalVotes = moderation.votes.length;
        const actionVotes = moderation.votes.filter(vote => vote.action === action).length;
        const votePercentage = (actionVotes / totalVotes) * 100;

        let threshold = action === 'ban' ? 75 : 66; // 75% for ban, 66% for delete/hide
        if (totalVotes >= 10 && votePercentage >= threshold) {
            const thread = await Thread.findById(threadId);
            if (!thread) {
                console.log(`Thread not found: ${threadId} from ${req.ip}`);
                return res.status(404).json({ error: 'Thread not found' });
            }

            if (action === 'delete') {
                await Thread.deleteOne({ _id: threadId });
                moderation.status = 'deleted';
            } else if (action === 'hide') {
                thread.hidden = true;
                await thread.save();
                moderation.status = 'hidden';
            } else if (action === 'ban') {
                const user = await User.findById(thread.author);
                if (user) {
                    user.status = 'banned';
                    await user.save();
                    moderation.status = 'banned';
                }
            }
            await moderation.save();
            console.log(`Moderation action ${action} applied to thread ${threadId} from ${req.ip}`);
        }

        console.log(`Vote cast by ${req.user.id} for ${action} on thread ${threadId} from ${req.ip}`);
        res.status(201).json({ message: 'Vote recorded' });
    } catch (error) {
        console.error(`Error voting on thread ${threadId} from ${req.ip}:`, error.message, error.stack);
        res.status(500).json({ error: 'Failed to record vote' });
    }
});

// Get moderation logs
router.get('/logs', async (req, res) => {
    try {
        const logs = await Moderation.find()
            .populate('threadId', 'title')
            .populate('flags.userId', 'username')
            .populate('votes.userId', 'username')
            .sort({ createdAt: -1 });
        console.log(`Fetched moderation logs from ${req.ip}`);
        res.json(logs);
    } catch (error) {
        console.error(`Error fetching moderation logs from ${req.ip}:`, error.message, error.stack);
        res.status(500).json({ error: 'Failed to fetch moderation logs' });
    }
});

module.exports = router;