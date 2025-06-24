const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Proposal = require('../models/Proposal');
const Vote = require('../models/Vote');
const User = require('../models/User');
const Thread = require('../models/Thread');

// @route   POST /api/governance/propose
// @desc    Submit a new governance proposal
// @access  Private (registered users only)
router.post('/propose', auth, async (req, res) => {
    try {
        const { title, description, type, votingDuration = 7, tags = [] } = req.body;

        // Validate required fields
        if (!title || !description || !type) {
            return res.status(400).json({ error: 'Title, description, and type are required' });
        }

        // Calculate voting end date
        const votingEnd = new Date();
        votingEnd.setDate(votingEnd.getDate() + votingDuration);

        // Create proposal
        const proposal = new Proposal({
            title,
            description,
            type,
            submittedBy: req.user.id,
            votingEnd,
            tags: Array.isArray(tags) ? tags : []
        });

        await proposal.save();

        // Create associated discussion thread in Governance category
        const discussionThread = new Thread({
            title: `[PROPOSAL] ${title}`,
            content: `${description}\n\n**Voting Period:** ${votingDuration} days\n**Proposal Type:** ${type}`,
            author: req.user.id,
            category: 'Governance',
            tags: [...tags, 'proposal', type],
            sticky: true,
            locked: false
        });

        await discussionThread.save();

        // Link proposal to discussion thread
        proposal.discussionThreadId = discussionThread._id;
        await proposal.save();

        // Populate submitter info
        await proposal.populate('submittedBy', 'username displayName');

        res.status(201).json({
            success: true,
            proposal: proposal,
            discussionThread: discussionThread._id
        });

    } catch (error) {
        console.error('Error creating proposal:', error);
        res.status(500).json({ error: 'Failed to create proposal' });
    }
});

// @route   POST /api/governance/vote
// @desc    Cast a vote on a proposal
// @access  Private (registered users only)
router.post('/vote', auth, async (req, res) => {
    try {
        const { proposalId, choice, reasoning } = req.body;

        // Validate inputs
        if (!proposalId || !choice) {
            return res.status(400).json({ error: 'Proposal ID and choice are required' });
        }

        if (!['yes', 'no', 'abstain'].includes(choice)) {
            return res.status(400).json({ error: 'Invalid vote choice' });
        }

        // Find proposal
        const proposal = await Proposal.findById(proposalId);
        if (!proposal) {
            return res.status(404).json({ error: 'Proposal not found' });
        }

        // Check if voting is still active
        if (!proposal.isVotingActive) {
            return res.status(400).json({ error: 'Voting period has ended' });
        }

        // Check for existing vote
        const existingVote = await Vote.findOne({
            proposalId: proposalId,
            userId: req.user.id
        });

        if (existingVote) {
            // Update existing vote
            const oldChoice = existingVote.choice;
            existingVote.choice = choice;
            existingVote.reasoning = reasoning;
            await existingVote.save();

            // Update proposal vote counts
            proposal[`${oldChoice}Votes`] -= 1;
            proposal[`${choice}Votes`] += 1;
        } else {
            // Create new vote
            const vote = new Vote({
                proposalId,
                userId: req.user.id,
                choice,
                reasoning
            });
            await vote.save();

            // Update proposal vote counts
            proposal[`${choice}Votes`] += 1;
            proposal.totalVotes += 1;
        }

        await proposal.save();

        res.json({
            success: true,
            message: existingVote ? 'Vote updated successfully' : 'Vote cast successfully',
            proposal: {
                id: proposal._id,
                yesVotes: proposal.yesVotes,
                noVotes: proposal.noVotes,
                abstainVotes: proposal.abstainVotes,
                totalVotes: proposal.totalVotes,
                percentages: proposal.getVotePercentages()
            }
        });

    } catch (error) {
        console.error('Error casting vote:', error);
        if (error.code === 11000) {
            res.status(400).json({ error: 'You have already voted on this proposal' });
        } else {
            res.status(500).json({ error: 'Failed to cast vote' });
        }
    }
});

// @route   GET /api/governance/proposals
// @desc    Get all proposals with filters
// @access  Public
router.get('/proposals', async (req, res) => {
    try {
        const { status = 'active', type, page = 1, limit = 10 } = req.query;
        
        const filter = {};
        if (status && status !== 'all') {
            filter.status = status;
        }
        if (type && type !== 'all') {
            filter.type = type;
        }

        const skip = (page - 1) * limit;

        const proposals = await Proposal.find(filter)
            .populate('submittedBy', 'username displayName')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const totalProposals = await Proposal.countDocuments(filter);

        // Add vote percentages and status for each proposal
        const proposalsWithDetails = proposals.map(proposal => ({
            ...proposal.toObject(),
            percentages: proposal.getVotePercentages(),
            hasPassed: proposal.hasPassed(),
            isVotingActive: proposal.isVotingActive
        }));

        res.json({
            success: true,
            proposals: proposalsWithDetails,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalProposals / limit),
                totalProposals,
                hasNext: page * limit < totalProposals,
                hasPrev: page > 1
            }
        });

    } catch (error) {
        console.error('Error fetching proposals:', error);
        res.status(500).json({ error: 'Failed to fetch proposals' });
    }
});

// @route   GET /api/governance/proposals/:id
// @desc    Get single proposal with full details
// @access  Public
router.get('/proposals/:id', async (req, res) => {
    try {
        const proposal = await Proposal.findById(req.params.id)
            .populate('submittedBy', 'username displayName avatar')
            .populate('discussionThreadId');

        if (!proposal) {
            return res.status(404).json({ error: 'Proposal not found' });
        }

        // Get recent votes with user info (for transparency)
        const recentVotes = await Vote.find({ proposalId: proposal._id })
            .populate('userId', 'username displayName')
            .sort({ createdAt: -1 })
            .limit(20);

        res.json({
            success: true,
            proposal: {
                ...proposal.toObject(),
                percentages: proposal.getVotePercentages(),
                hasPassed: proposal.hasPassed(),
                isVotingActive: proposal.isVotingActive
            },
            recentVotes: recentVotes.map(vote => ({
                choice: vote.choice,
                reasoning: vote.reasoning,
                voter: vote.userId.displayName || vote.userId.username,
                timestamp: vote.createdAt
            }))
        });

    } catch (error) {
        console.error('Error fetching proposal:', error);
        res.status(500).json({ error: 'Failed to fetch proposal' });
    }
});

// @route   GET /api/governance/user-vote/:proposalId
// @desc    Get current user's vote on a proposal
// @access  Private
router.get('/user-vote/:proposalId', auth, async (req, res) => {
    try {
        const vote = await Vote.findOne({
            proposalId: req.params.proposalId,
            userId: req.user.id
        });

        res.json({
            success: true,
            vote: vote ? {
                choice: vote.choice,
                reasoning: vote.reasoning,
                timestamp: vote.createdAt
            } : null
        });

    } catch (error) {
        console.error('Error fetching user vote:', error);
        res.status(500).json({ error: 'Failed to fetch vote' });
    }
});

module.exports = router;
