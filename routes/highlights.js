const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const optionalAuth = require('../middleware/optionalAuth');
const ContentHighlight = require('../models/ContentHighlight');
const Blog = require('../models/Blog');
const Thread = require('../models/Thread');
const Chronicle = require('../models/Chronicle');

// Content type to model mapping
const getContentModel = (contentType) => {
    switch (contentType) {
        case 'blog': return Blog;
        case 'thread': return Thread;
        case 'chronicle': return Chronicle;
        default: return null;
    }
};

// @route   POST /api/highlights/vote
// @desc    Vote for community highlight
// @access  Private (registered users only)
router.post('/vote', auth, async (req, res) => {
    try {
        const { contentType, contentId, section } = req.body;

        // Validate inputs
        if (!contentType || !contentId || !section) {
            return res.status(400).json({ error: 'Content type, ID, and section are required' });
        }

        const ContentModel = getContentModel(contentType);
        if (!ContentModel) {
            return res.status(400).json({ error: 'Invalid content type' });
        }

        // Verify content exists
        const content = await ContentModel.findById(contentId);
        if (!content) {
            return res.status(404).json({ error: 'Content not found' });
        }

        // Find or create community highlight
        let highlight = await ContentHighlight.findOne({
            contentType,
            contentId,
            highlightType: 'community',
            section
        });

        if (!highlight) {
            highlight = new ContentHighlight({
                contentType,
                contentId,
                highlightType: 'community',
                section,
                votesCount: 1
            });
        } else {
            highlight.votesCount += 1;
        }

        await highlight.save();

        res.json({
            success: true,
            message: 'Vote cast successfully',
            votesCount: highlight.votesCount
        });

    } catch (error) {
        console.error('Error voting for highlight:', error);
        res.status(500).json({ error: 'Failed to cast vote' });
    }
});

// @route   POST /api/highlights/admin-feature
// @desc    Admin feature content
// @access  Private (Admin only)
router.post('/admin-feature', auth, async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { contentType, contentId, section, adminNotes } = req.body;

        // Validate inputs
        if (!contentType || !contentId || !section) {
            return res.status(400).json({ error: 'Content type, ID, and section are required' });
        }

        const ContentModel = getContentModel(contentType);
        if (!ContentModel) {
            return res.status(400).json({ error: 'Invalid content type' });
        }

        // Verify content exists
        const content = await ContentModel.findById(contentId);
        if (!content) {
            return res.status(404).json({ error: 'Content not found' });
        }

        // Remove previous admin highlight for this section
        await ContentHighlight.findOneAndUpdate(
            {
                highlightType: 'admin',
                section,
                active: true
            },
            { active: false }
        );

        // Create or update admin highlight
        let highlight = await ContentHighlight.findOne({
            contentType,
            contentId,
            highlightType: 'admin',
            section
        });

        if (!highlight) {
            highlight = new ContentHighlight({
                contentType,
                contentId,
                highlightType: 'admin',
                section,
                curatedBy: req.user.id,
                adminNotes,
                active: true
            });
        } else {
            highlight.curatedBy = req.user.id;
            highlight.adminNotes = adminNotes;
            highlight.active = true;
            highlight.featuredDate = new Date();
        }

        await highlight.save();

        res.json({
            success: true,
            message: 'Content featured successfully',
            highlight
        });

    } catch (error) {
        console.error('Error featuring content:', error);
        res.status(500).json({ error: 'Failed to feature content' });
    }
});

// @route   GET /api/highlights/:section
// @desc    Get highlights for a section
// @access  Public
router.get('/:section', optionalAuth, async (req, res) => {
    try {
        const { section } = req.params;

        // Get community highlight (highest votes)
        const communityHighlight = await ContentHighlight.findOne({
            section,
            highlightType: 'community',
            active: true
        })
        .sort({ votesCount: -1, featuredDate: -1 })
        .limit(1);

        // Get admin highlight (most recent)
        const adminHighlight = await ContentHighlight.findOne({
            section,
            highlightType: 'admin',
            active: true
        })
        .populate('curatedBy', 'username displayName')
        .sort({ featuredDate: -1 })
        .limit(1);

        const highlights = [];

        // Populate content details for community highlight
        if (communityHighlight) {
            const ContentModel = getContentModel(communityHighlight.contentType);
            const content = await ContentModel.findById(communityHighlight.contentId)
                .populate('author', 'username displayName avatar');
            
            if (content) {
                highlights.push({
                    type: 'community',
                    votes: communityHighlight.votesCount,
                    content: {
                        id: content._id,
                        title: content.title,
                        excerpt: content.content ? content.content.substring(0, 200) + '...' : '',
                        author: content.author,
                        createdAt: content.createdAt,
                        contentType: communityHighlight.contentType
                    }
                });
            }
        }

        // Populate content details for admin highlight
        if (adminHighlight) {
            const ContentModel = getContentModel(adminHighlight.contentType);
            const content = await ContentModel.findById(adminHighlight.contentId)
                .populate('author', 'username displayName avatar');
            
            if (content) {
                highlights.push({
                    type: 'admin',
                    curatedBy: adminHighlight.curatedBy,
                    adminNotes: adminHighlight.adminNotes,
                    featuredDate: adminHighlight.featuredDate,
                    content: {
                        id: content._id,
                        title: content.title,
                        excerpt: content.content ? content.content.substring(0, 200) + '...' : '',
                        author: content.author,
                        createdAt: content.createdAt,
                        contentType: adminHighlight.contentType
                    }
                });
            }
        }

        res.json({
            success: true,
            section,
            highlights
        });

    } catch (error) {
        console.error('Error fetching highlights:', error);
        res.status(500).json({ error: 'Failed to fetch highlights' });
    }
});

// @route   GET /api/highlights/admin/dashboard
// @desc    Get admin dashboard data for curation
// @access  Private (Admin only)
router.get('/admin/dashboard', auth, async (req, res) => {
    try {
        // Check if user is admin
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        // Get recent content with engagement metrics
        const recentBlogs = await Blog.find({})
            .populate('author', 'username displayName')
            .sort({ createdAt: -1 })
            .limit(10);

        const recentThreads = await Thread.find({})
            .populate('author', 'username displayName')
            .sort({ createdAt: -1 })
            .limit(10);

        const recentChronicles = await Chronicle.find({})
            .populate('author', 'username displayName')
            .sort({ createdAt: -1 })
            .limit(10);

        // Get current highlights
        const currentHighlights = await ContentHighlight.find({ active: true })
            .populate('curatedBy', 'username displayName')
            .sort({ featuredDate: -1 });

        // Format content for curation interface
        const formatContent = (items, type) => items.map(item => ({
            id: item._id,
            title: item.title,
            author: item.author,
            createdAt: item.createdAt,
            contentType: type,
            excerpt: item.content ? item.content.substring(0, 150) + '...' : '',
            isHighlighted: currentHighlights.some(h => 
                h.contentId.toString() === item._id.toString() && 
                h.contentType === type && 
                h.active
            )
        }));

        const allContent = [
            ...formatContent(recentBlogs, 'blog'),
            ...formatContent(recentThreads, 'thread'),
            ...formatContent(recentChronicles, 'chronicle')
        ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json({
            success: true,
            content: allContent,
            currentHighlights: currentHighlights.map(h => ({
                ...h.toObject(),
                content: allContent.find(c => c.id === h.contentId.toString())
            }))
        });

    } catch (error) {
        console.error('Error fetching admin dashboard:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
});

module.exports = router;
