const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Proposal = require('../models/Proposal');
const Vote = require('../models/Vote');
const User = require('../models/User');
const Thread = require('../models/Thread');
const adminAuth = require('../middleware/adminAuth');

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

// ============================================================================
// PROPOSAL CREATION & MANAGEMENT
// ============================================================================

// Create a new governance proposal (creates both thread and proposal)
router.post('/proposals', auth, async (req, res) => {
    try {
        const { title, content, type, priority, estimatedEffort, deadline, votingPeriodDays } = req.body;
        
        if (!title || !content || !type) {
            return res.status(400).json({ error: 'Title, content, and type are required' });
        }

        // Create the discussion thread first
        const thread = new Thread({
            title: `[PROPOSAL] ${title}`,
            content,
            category: 'Governance',
            author: req.user.id,
            isProposal: true,
            proposalData: {
                type,
                priority: priority || 'medium',
                estimatedEffort: estimatedEffort || 'medium',
                deadline: deadline ? new Date(deadline) : null
            }
        });

        await thread.save();

        // Create the proposal record
        const proposal = new Proposal({
            title,
            description: content,
            type,
            author: req.user.id,
            threadId: thread._id,
            votingPeriodDays: votingPeriodDays || 7,
            implementation: {
                priority: priority || 'medium',
                estimatedEffort: estimatedEffort || 'medium',
                deadline: deadline ? new Date(deadline) : null
            }
        });

        await proposal.save();

        // Populate the response
        await proposal.populate('author', 'username displayName');
        await proposal.populate('threadId');

        console.log(`New governance proposal created by user ${req.user.id}: ${proposal._id}`);
        res.status(201).json(proposal);
        
    } catch (error) {
        console.error('Error creating governance proposal:', error);
        res.status(500).json({ error: 'Failed to create proposal' });
    }
});

// Get all proposals with filtering
router.get('/proposals', async (req, res) => {
    try {
        const { 
            status, 
            type, 
            page = 1, 
            limit = 20,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        const query = {};
        if (status) query.status = status;
        if (type) query.type = type;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const sortDirection = sortOrder === 'desc' ? -1 : 1;

        const proposals = await Proposal.find(query)
            .populate('author', 'username displayName')
            .populate('threadId', 'title createdAt replies')
            .sort({ [sortBy]: sortDirection })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Proposal.countDocuments(query);

        res.json({
            proposals,
            pagination: {
                page: parseInt(page),
                pages: Math.ceil(total / limit),
                total
            }
        });
        
    } catch (error) {
        console.error('Error fetching proposals:', error);
        res.status(500).json({ error: 'Failed to fetch proposals' });
    }
});

// Get single proposal by ID
router.get('/proposals/:id', async (req, res) => {
    try {
        const proposal = await Proposal.findById(req.params.id)
            .populate('author', 'username displayName')
            .populate('threadId')
            .populate('implementation.assignedTo', 'username displayName');

        if (!proposal) {
            return res.status(404).json({ error: 'Proposal not found' });
        }

        // Get voting statistics
        const voteStats = await Vote.getProposalStats(proposal._id);
        
        // Update proposal vote counts
        proposal.votes = voteStats;
        await proposal.save();

        // Check if user has voted (if authenticated)
        let userVote = null;
        if (req.user) {
            userVote = await Vote.hasUserVoted(proposal._id, req.user.id);
        }

        res.json({
            ...proposal.toObject(),
            userVote
        });
        
    } catch (error) {
        console.error('Error fetching proposal:', error);
        res.status(500).json({ error: 'Failed to fetch proposal' });
    }
});

// ============================================================================
// VOTING SYSTEM
// ============================================================================

// Start voting on a proposal (discussion -> voting)
router.post('/proposals/:id/start-voting', auth, async (req, res) => {
    try {
        const proposal = await Proposal.findById(req.params.id);
        
        if (!proposal) {
            return res.status(404).json({ error: 'Proposal not found' });
        }

        // Only author or admin can start voting
        const isAuthor = proposal.author.toString() === req.user.id;
        const isAdmin = req.user.role === 'admin';
        
        if (!isAuthor && !isAdmin) {
            return res.status(403).json({ error: 'Only proposal author or admin can start voting' });
        }

        if (proposal.status !== 'discussion') {
            return res.status(400).json({ error: 'Proposal must be in discussion phase to start voting' });
        }

        // Set voting period
        const votingStartDate = new Date();
        const votingEndDate = new Date();
        votingEndDate.setDate(votingEndDate.getDate() + proposal.votingPeriodDays);

        proposal.status = 'voting';
        proposal.votingStartDate = votingStartDate;
        proposal.votingEndDate = votingEndDate;

        await proposal.save();

        console.log(`Voting started on proposal ${proposal._id} by user ${req.user.id}`);
        res.json({ message: 'Voting started successfully', proposal });
        
    } catch (error) {
        console.error('Error starting voting:', error);
        res.status(500).json({ error: 'Failed to start voting' });
    }
});

// Cast a vote on a proposal
router.post('/proposals/:id/vote', auth, async (req, res) => {
    try {
        const { choice, reasoning } = req.body;
        const proposalId = req.params.id;
        
        if (!choice || !['approve', 'reject', 'abstain'].includes(choice)) {
            return res.status(400).json({ error: 'Valid choice (approve/reject/abstain) is required' });
        }

        const proposal = await Proposal.findById(proposalId);
        
        if (!proposal) {
            return res.status(404).json({ error: 'Proposal not found' });
        }

        if (!proposal.isVotingActive) {
            return res.status(400).json({ error: 'Voting is not active for this proposal' });
        }

        // Check if user has already voted
        const existingVote = await Vote.findOne({
            proposal: proposalId,
            voter: req.user.id
        });

        if (existingVote) {
            // Update existing vote
            existingVote.choice = choice;
            existingVote.reasoning = reasoning || null;
            await existingVote.save();
        } else {
            // Create new vote
            const vote = new Vote({
                proposal: proposalId,
                voter: req.user.id,
                choice,
                reasoning: reasoning || null
            });
            await vote.save();
        }

        // Update proposal vote counts
        const voteStats = await Vote.getProposalStats(proposalId);
        proposal.votes = voteStats;
        await proposal.save();

        console.log(`User ${req.user.id} voted "${choice}" on proposal ${proposalId}`);
        res.json({ message: 'Vote recorded successfully', choice });
        
    } catch (error) {
        console.error('Error recording vote:', error);
        res.status(500).json({ error: 'Failed to record vote' });
    }
});

// Get voting results for a proposal
router.get('/proposals/:id/results', async (req, res) => {
    try {
        const proposal = await Proposal.findById(req.params.id);
        
        if (!proposal) {
            return res.status(404).json({ error: 'Proposal not found' });
        }

        const voteStats = await Vote.getProposalStats(proposal._id);
        
        // Get detailed vote breakdown if requested
        const includeDetails = req.query.details === 'true';
        let voteDetails = null;
        
        if (includeDetails) {
            voteDetails = await Vote.find({ proposal: proposal._id })
                .populate('voter', 'username displayName')
                .select('choice reasoning createdAt voter')
                .sort({ createdAt: -1 });
        }

        res.json({
            proposalId: proposal._id,
            status: proposal.status,
            votingPeriod: {
                start: proposal.votingStartDate,
                end: proposal.votingEndDate,
                isActive: proposal.isVotingActive
            },
            results: voteStats,
            threshold: {
                required: proposal.passThreshold,
                current: proposal.approvalPercentage
            },
            hasPassed: proposal.hasPassed,
            minimumVotes: proposal.minimumVotes,
            details: voteDetails
        });
        
    } catch (error) {
        console.error('Error fetching voting results:', error);
        res.status(500).json({ error: 'Failed to fetch voting results' });
    }
});

// ============================================================================
// IMPLEMENTATION TRACKING (Admin Functions)
// ============================================================================

// Update proposal implementation status (admin only)
router.put('/proposals/:id/implementation', adminAuth, async (req, res) => {
    try {
        const { status, priority, assignedTo, deadline, progressNote } = req.body;
        
        const proposal = await Proposal.findById(req.params.id);
        
        if (!proposal) {
            return res.status(404).json({ error: 'Proposal not found' });
        }

        // Update implementation fields
        if (status) {
            if (status === 'implemented') {
                proposal.implementation.completedAt = new Date();
            }
            proposal.status = status;
        }
        
        if (priority) proposal.implementation.priority = priority;
        if (assignedTo) proposal.implementation.assignedTo = assignedTo;
        if (deadline) proposal.implementation.deadline = new Date(deadline);
        
        // Add progress note
        if (progressNote) {
            proposal.implementation.progressNotes.push({
                note: progressNote,
                author: req.user.id,
                timestamp: new Date()
            });
        }

        await proposal.save();

        console.log(`Admin ${req.user.id} updated implementation for proposal ${proposal._id}`);
        res.json({ message: 'Implementation status updated', proposal });
        
    } catch (error) {
        console.error('Error updating implementation:', error);
        res.status(500).json({ error: 'Failed to update implementation' });
    }
});

// Get admin dashboard data
router.get('/admin/dashboard', adminAuth, async (req, res) => {
    try {
        // Get proposals requiring admin attention
        const pendingImplementation = await Proposal.find({ 
            status: 'passed',
            'implementation.completedAt': null
        })
        .populate('author', 'username displayName')
        .sort({ createdAt: 1 }); // Oldest first

        const inProgress = await Proposal.find({ 
            status: 'implemented',
            'implementation.completedAt': null
        })
        .populate('author', 'username displayName')
        .populate('implementation.assignedTo', 'username displayName')
        .sort({ 'implementation.deadline': 1 });

        // Get voting statistics
        const activeVoting = await Proposal.find({ status: 'voting' })
            .populate('author', 'username displayName')
            .sort({ votingEndDate: 1 });

        // Get recent completed items
        const recentlyCompleted = await Proposal.find({ 
            status: 'implemented',
            'implementation.completedAt': { $ne: null }
        })
        .populate('author', 'username displayName')
        .sort({ 'implementation.completedAt': -1 })
        .limit(10);

        res.json({
            pendingImplementation,
            inProgress,
            activeVoting,
            recentlyCompleted,
            statistics: {
                totalProposals: await Proposal.countDocuments(),
                passedProposals: await Proposal.countDocuments({ status: 'passed' }),
                implementedProposals: await Proposal.countDocuments({ status: 'implemented' }),
                activeVotes: activeVoting.length
            }
        });
        
    } catch (error) {
        console.error('Error fetching admin dashboard:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
});

// ============================================================================
// USER VOTING HISTORY
// ============================================================================

// Get user's voting history
router.get('/my-votes', auth, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const votes = await Vote.getUserVotingHistory(req.user.id, limit);
        
        res.json({ votes });
        
    } catch (error) {
        console.error('Error fetching user voting history:', error);
        res.status(500).json({ error: 'Failed to fetch voting history' });
    }
});

// ============================================================================
// UTILITY ENDPOINTS
// ============================================================================

// Get governance statistics
router.get('/stats', async (req, res) => {
    try {
        const stats = {
            totalProposals: await Proposal.countDocuments(),
            activeVoting: await Proposal.countDocuments({ status: 'voting' }),
            passedProposals: await Proposal.countDocuments({ status: 'passed' }),
            implementedProposals: await Proposal.countDocuments({ status: 'implemented' }),
            totalVotes: await Vote.countDocuments(),
            proposalsByType: await Proposal.aggregate([
                { $group: { _id: '$type', count: { $sum: 1 } } }
            ])
        };

        res.json(stats);
        
    } catch (error) {
        console.error('Error fetching governance stats:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});

module.exports = router;
