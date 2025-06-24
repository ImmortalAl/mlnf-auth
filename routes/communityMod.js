const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const UserFlag = require('../models/UserFlag');
const ModerationCase = require('../models/ModerationCase');
const Vote = require('../models/Vote');
const User = require('../models/User');

// @route   POST /api/community-mod/flag-user
// @desc    Flag a user for community review
// @access  Private (registered users only)
router.post('/flag-user', auth, async (req, res) => {
    try {
        const { flaggedUserId, reason, description, relatedContent } = req.body;

        // Validate inputs
        if (!flaggedUserId || !reason) {
            return res.status(400).json({ error: 'Flagged user ID and reason are required' });
        }

        // Check if flagged user exists
        const flaggedUser = await User.findById(flaggedUserId);
        if (!flaggedUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Prevent self-flagging
        if (flaggedUserId === req.user.id) {
            return res.status(400).json({ error: 'Cannot flag yourself' });
        }

        // Check for existing recent flag from same reporter
        const existingFlag = await UserFlag.findOne({
            reporterId: req.user.id,
            flaggedUserId: flaggedUserId,
            status: 'pending',
            createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
        });

        if (existingFlag) {
            return res.status(400).json({ error: 'You have already flagged this user in the last 24 hours' });
        }

        // Create flag
        const flag = new UserFlag({
            reporterId: req.user.id,
            flaggedUserId,
            reason,
            description,
            relatedContent,
            status: 'pending'
        });

        await flag.save();

        // Check if this user has reached the threshold for community review (5+ flags)
        const totalFlags = await UserFlag.countDocuments({
            flaggedUserId,
            status: 'pending'
        });

        if (totalFlags >= 5) {
            // Create moderation case
            const allFlags = await UserFlag.find({
                flaggedUserId,
                status: 'pending'
            });

            const moderationCase = new ModerationCase({
                flaggedUserId,
                flags: allFlags.map(f => f._id),
                caseType: 'warning', // Start with warning
                description: `Community review triggered by ${totalFlags} flags. Reasons: ${allFlags.map(f => f.reason).join(', ')}`,
                status: 'voting',
                votingStart: new Date(),
                votingEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days voting period
            });

            await moderationCase.save();

            // Update flags to reference the moderation case
            await UserFlag.updateMany(
                { flaggedUserId, status: 'pending' },
                { status: 'under_review', moderationCase: moderationCase._id }
            );

            res.json({
                success: true,
                message: 'Flag submitted and community review triggered',
                moderationCase: moderationCase._id
            });
        } else {
            res.json({
                success: true,
                message: `Flag submitted successfully. ${5 - totalFlags} more flags needed for community review.`
            });
        }

    } catch (error) {
        console.error('Error flagging user:', error);
        res.status(500).json({ error: 'Failed to submit flag' });
    }
});

// @route   POST /api/community-mod/vote-case
// @desc    Vote on a moderation case
// @access  Private (registered users only)
router.post('/vote-case', auth, async (req, res) => {
    try {
        const { caseId, choice, reasoning } = req.body;

        // Validate inputs
        if (!caseId || !choice) {
            return res.status(400).json({ error: 'Case ID and choice are required' });
        }

        if (!['support', 'oppose', 'abstain'].includes(choice)) {
            return res.status(400).json({ error: 'Invalid vote choice' });
        }

        // Find moderation case
        const moderationCase = await ModerationCase.findById(caseId);
        if (!moderationCase) {
            return res.status(404).json({ error: 'Moderation case not found' });
        }

        // Check if voting is still active
        if (moderationCase.status !== 'voting' || new Date() > moderationCase.votingEnd) {
            return res.status(400).json({ error: 'Voting period has ended' });
        }

        // Prevent voting on your own case
        if (moderationCase.flaggedUserId.toString() === req.user.id) {
            return res.status(403).json({ error: 'Cannot vote on moderation case against yourself' });
        }

        // Check for existing vote (using a generic Vote model with case reference)
        const existingVote = await Vote.findOne({
            userId: req.user.id,
            proposalId: caseId // Reusing proposalId field for moderation cases
        });

        if (existingVote) {
            // Update existing vote
            const oldChoice = existingVote.choice === 'yes' ? 'support' : 
                            existingVote.choice === 'no' ? 'oppose' : 'abstain';
            
            moderationCase[`${oldChoice}Votes`] -= 1;
            moderationCase[`${choice}Votes`] += 1;
            
            existingVote.choice = choice === 'support' ? 'yes' : 
                                choice === 'oppose' ? 'no' : 'abstain';
            existingVote.reasoning = reasoning;
            await existingVote.save();
        } else {
            // Create new vote
            const vote = new Vote({
                proposalId: caseId, // Reusing for moderation cases
                userId: req.user.id,
                choice: choice === 'support' ? 'yes' : 
                       choice === 'oppose' ? 'no' : 'abstain',
                reasoning
            });
            await vote.save();

            moderationCase[`${choice}Votes`] += 1;
            moderationCase.totalVotes += 1;
        }

        await moderationCase.save();

        res.json({
            success: true,
            message: 'Vote cast successfully',
            case: {
                id: moderationCase._id,
                supportVotes: moderationCase.supportVotes,
                opposeVotes: moderationCase.opposeVotes,
                abstainVotes: moderationCase.abstainVotes,
                totalVotes: moderationCase.totalVotes
            }
        });

    } catch (error) {
        console.error('Error voting on moderation case:', error);
        res.status(500).json({ error: 'Failed to cast vote' });
    }
});

// @route   GET /api/community-mod/cases
// @desc    Get active moderation cases
// @access  Public
router.get('/cases', async (req, res) => {
    try {
        const { status = 'voting', page = 1, limit = 10 } = req.query;
        
        const filter = {};
        if (status !== 'all') {
            filter.status = status;
        }

        const skip = (page - 1) * limit;

        const cases = await ModerationCase.find(filter)
            .populate('flaggedUserId', 'username displayName')
            .populate('flags')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const totalCases = await ModerationCase.countDocuments(filter);

        res.json({
            success: true,
            cases: cases.map(caseItem => ({
                ...caseItem.toObject(),
                isVotingActive: caseItem.status === 'voting' && new Date() <= caseItem.votingEnd
            })),
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalCases / limit),
                totalCases,
                hasNext: page * limit < totalCases,
                hasPrev: page > 1
            }
        });

    } catch (error) {
        console.error('Error fetching moderation cases:', error);
        res.status(500).json({ error: 'Failed to fetch cases' });
    }
});

// @route   GET /api/community-mod/cases/:id
// @desc    Get single moderation case with details
// @access  Public
router.get('/cases/:id', async (req, res) => {
    try {
        const moderationCase = await ModerationCase.findById(req.params.id)
            .populate('flaggedUserId', 'username displayName avatar')
            .populate({
                path: 'flags',
                populate: {
                    path: 'reporterId',
                    select: 'username displayName'
                }
            });

        if (!moderationCase) {
            return res.status(404).json({ error: 'Moderation case not found' });
        }

        // Get recent votes
        const recentVotes = await Vote.find({ proposalId: moderationCase._id })
            .populate('userId', 'username displayName')
            .sort({ createdAt: -1 })
            .limit(20);

        res.json({
            success: true,
            case: {
                ...moderationCase.toObject(),
                isVotingActive: moderationCase.status === 'voting' && new Date() <= moderationCase.votingEnd
            },
            recentVotes: recentVotes.map(vote => ({
                choice: vote.choice === 'yes' ? 'support' : 
                       vote.choice === 'no' ? 'oppose' : 'abstain',
                reasoning: vote.reasoning,
                voter: vote.userId.displayName || vote.userId.username,
                timestamp: vote.createdAt
            }))
        });

    } catch (error) {
        console.error('Error fetching moderation case:', error);
        res.status(500).json({ error: 'Failed to fetch case' });
    }
});

// @route   PUT /api/community-mod/cases/:id/implement
// @desc    Implement community moderation decision (Admin only)
// @access  Private (Admin)
router.put('/cases/:id/implement', auth, async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const moderationCase = await ModerationCase.findById(req.params.id);
        if (!moderationCase) {
            return res.status(404).json({ error: 'Moderation case not found' });
        }

        // Check if case has been decided
        if (moderationCase.status !== 'decided') {
            return res.status(400).json({ error: 'Case must be decided before implementation' });
        }

        // Implement the decision based on community vote
        const supportPercentage = moderationCase.totalVotes > 0 ? 
            (moderationCase.supportVotes / moderationCase.totalVotes) : 0;

        if (supportPercentage >= 0.5) {
            // Community supports the moderation action
            const flaggedUser = await User.findById(moderationCase.flaggedUserId);
            
            switch (moderationCase.caseType) {
                case 'warning':
                    // Send warning notification
                    break;
                case 'temporary_restriction':
                    // Implement temporary restriction
                    break;
                case 'deportation':
                    flaggedUser.banned = true;
                    await flaggedUser.save();
                    break;
            }

            moderationCase.decision = 'approved';
        } else {
            moderationCase.decision = 'rejected';
        }

        moderationCase.status = 'implemented';
        moderationCase.implementedBy = req.user.id;
        moderationCase.implementedAt = new Date();
        await moderationCase.save();

        res.json({
            success: true,
            message: 'Moderation decision implemented',
            decision: moderationCase.decision
        });

    } catch (error) {
        console.error('Error implementing moderation decision:', error);
        res.status(500).json({ error: 'Failed to implement decision' });
    }
});

module.exports = router;
