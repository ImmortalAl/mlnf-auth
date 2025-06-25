const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const optionalAuth = require('../middleware/optionalAuth');
const auth = require('../middleware/auth');
const AnonymousSubmission = require('../models/AnonymousSubmission');
const MessageBoardSection = require('../models/MessageBoardSection');

// Generate submission fingerprint for basic tracking
const generateFingerprint = (req) => {
    const data = req.ip + req.get('User-Agent') + Date.now();
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
};

// @route   POST /api/anonymous/submit
// @desc    Submit anonymous content to designated sections
// @access  Public
router.post('/submit', async (req, res) => {
    try {
        const { content, sectionId, displayName } = req.body;

        // Validate inputs
        if (!content || !sectionId) {
            return res.status(400).json({ error: 'Content and section ID are required' });
        }

        // Check if section exists and allows anonymous submissions
        const section = await MessageBoardSection.findById(sectionId);
        if (!section) {
            return res.status(404).json({ error: 'Section not found' });
        }

        if (!section.allowsAnonymous) {
            return res.status(403).json({ error: 'This section does not allow anonymous submissions' });
        }

        // Rate limiting: Check for recent submissions from same fingerprint
        const fingerprint = generateFingerprint(req);
        const recentSubmissions = await AnonymousSubmission.countDocuments({
            submissionFingerprint: fingerprint,
            createdAt: { $gte: new Date(Date.now() - 15 * 60 * 1000) } // Last 15 minutes
        });

        if (recentSubmissions >= 3) {
            return res.status(429).json({ error: 'Too many submissions. Please wait before submitting again.' });
        }

        // Create anonymous submission
        const submission = new AnonymousSubmission({
            content: content.trim(),
            sectionId,
            displayName: displayName ? displayName.trim() : 'Anonymous Seeker',
            submissionFingerprint: fingerprint,
            ipAddress: req.ip,
            userAgent: req.get('User-Agent'),
            status: 'published'
        });

        await submission.save();

        res.status(201).json({
            success: true,
            message: 'Anonymous submission published successfully',
            submission: {
                id: submission._id,
                content: submission.content,
                displayName: submission.displayName,
                createdAt: submission.createdAt
            }
        });

    } catch (error) {
        console.error('Error creating anonymous submission:', error);
        res.status(500).json({ error: 'Failed to create submission' });
    }
});

// @route   GET /api/anonymous/submissions/:sectionId
// @desc    Get anonymous submissions for a section
// @access  Public
router.get('/submissions/:sectionId', async (req, res) => {
    try {
        const { sectionId } = req.params;
        const { page = 1, limit = 20, status = 'published' } = req.query;

        // Verify section exists
        const section = await MessageBoardSection.findById(sectionId);
        if (!section) {
            return res.status(404).json({ error: 'Section not found' });
        }

        const filter = { sectionId };
        if (status !== 'all') {
            filter.status = status;
        }

        const skip = (page - 1) * limit;

        const submissions = await AnonymousSubmission.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const totalSubmissions = await AnonymousSubmission.countDocuments(filter);

        // Remove sensitive data from response
        const safeSubmissions = submissions.map(sub => ({
            id: sub._id,
            content: sub.content,
            displayName: sub.displayName,
            createdAt: sub.createdAt,
            status: sub.status,
            views: sub.views,
            flagsCount: sub.flags ? sub.flags.length : 0
        }));

        res.json({
            success: true,
            submissions: safeSubmissions,
            section: {
                id: section._id,
                name: section.sectionName,
                description: section.description
            },
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(totalSubmissions / limit),
                totalSubmissions,
                hasNext: page * limit < totalSubmissions,
                hasPrev: page > 1
            }
        });

    } catch (error) {
        console.error('Error fetching anonymous submissions:', error);
        res.status(500).json({ error: 'Failed to fetch submissions' });
    }
});

// @route   POST /api/anonymous/flag/:id
// @desc    Flag anonymous submission for review
// @access  Private (registered users only)
router.post('/flag/:id', auth, async (req, res) => {
    try {
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json({ error: 'Reason is required' });
        }

        const submission = await AnonymousSubmission.findById(req.params.id);
        if (!submission) {
            return res.status(404).json({ error: 'Submission not found' });
        }

        // Check if user already flagged this submission
        const existingFlag = submission.flags.find(
            flag => flag.reporterId && flag.reporterId.toString() === req.user.id
        );

        if (existingFlag) {
            return res.status(400).json({ error: 'You have already flagged this submission' });
        }

        // Add flag
        submission.flags.push({
            reporterId: req.user.id,
            reason,
            timestamp: new Date()
        });

        // Auto-moderate if enough flags (5+)
        if (submission.flags.length >= 5) {
            submission.status = 'flagged';
        }

        await submission.save();

        res.json({
            success: true,
            message: 'Submission flagged successfully',
            flagsCount: submission.flags.length
        });

    } catch (error) {
        console.error('Error flagging submission:', error);
        res.status(500).json({ error: 'Failed to flag submission' });
    }
});

// @route   GET /api/anonymous/sections
// @desc    Get all message board sections
// @access  Public
router.get('/sections', async (req, res) => {
    try {
        const sections = await MessageBoardSection.find({ active: true })
            .sort({ displayOrder: 1, sectionName: 1 });

        res.json({
            success: true,
            sections: sections.map(section => ({
                id: section._id,
                name: section.sectionName,
                description: section.description,
                category: section.category,
                allowsAnonymous: section.allowsAnonymous,
                allowsRegistered: section.allowsRegistered
            }))
        });

    } catch (error) {
        console.error('Error fetching sections:', error);
        res.status(500).json({ error: 'Failed to fetch sections' });
    }
});

// @route   PUT /api/anonymous/moderate/:id
// @desc    Moderate anonymous submission (Admin only)
// @access  Private (Admin)
router.put('/moderate/:id', auth, async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { status, moderationNotes } = req.body;
        const submission = await AnonymousSubmission.findById(req.params.id);

        if (!submission) {
            return res.status(404).json({ error: 'Submission not found' });
        }

        if (status) {
            submission.status = status;
        }
        if (moderationNotes) {
            submission.moderationNotes = moderationNotes;
        }

        await submission.save();

        res.json({
            success: true,
            message: 'Submission moderated successfully',
            submission: {
                id: submission._id,
                status: submission.status,
                moderationNotes: submission.moderationNotes
            }
        });

    } catch (error) {
        console.error('Error moderating submission:', error);
        res.status(500).json({ error: 'Failed to moderate submission' });
    }
});

// @route   POST /api/anonymous/sections
// @desc    Create new message board section (Admin only)
// @access  Private (Admin)
router.post('/sections', auth, async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { 
            sectionName, 
            description, 
            allowsAnonymous = false, 
            allowsRegistered = true,
            category = 'Ideas',
            displayOrder = 0
        } = req.body;

        if (!sectionName) {
            return res.status(400).json({ error: 'Section name is required' });
        }

        const section = new MessageBoardSection({
            sectionName,
            description,
            allowsAnonymous,
            allowsRegistered,
            category,
            displayOrder
        });

        await section.save();

        res.status(201).json({
            success: true,
            message: 'Section created successfully',
            section
        });

    } catch (error) {
        console.error('Error creating section:', error);
        if (error.code === 11000) {
            res.status(400).json({ error: 'Section name already exists' });
        } else {
            res.status(500).json({ error: 'Failed to create section' });
        }
    }
});

module.exports = router;


