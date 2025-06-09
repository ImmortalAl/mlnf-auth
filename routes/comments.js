const express = require('express');
const router = express.Router();
const Comment = require('../models/Comment');
const auth = require('../middleware/auth');
const optionalAuth = require('../middleware/optionalAuth');

// Get comments for a specific target (blog post, profile, etc.)
router.get('/:targetType/:targetId', optionalAuth, async (req, res) => {
    try {
        const { targetType, targetId } = req.params;
        
        const comments = await Comment.find({ 
            targetType, 
            targetId 
        })
        .populate('author', 'username displayName avatar')
        .sort({ createdAt: -1 });
        
        res.json(comments);
    } catch (error) {
        console.error('Error fetching comments:', error);
        res.status(500).json({ error: 'Failed to fetch comments' });
    }
});

// Create a new comment
router.post('/', auth, async (req, res) => {
    try {
        const { content, targetType, targetId } = req.body;
        
        if (!content || !targetType || !targetId) {
            return res.status(400).json({ 
                error: 'Content, target type, and target ID are required' 
            });
        }
        
        const comment = new Comment({
            content,
            targetType,
            targetId,
            author: req.user.id
        });
        
        await comment.save();
        
        // Populate author info before returning
        const populatedComment = await Comment.findById(comment._id)
            .populate('author', 'username displayName avatar');
            
        res.status(201).json(populatedComment);
    } catch (error) {
        console.error('Error creating comment:', error);
        res.status(500).json({ error: 'Failed to create comment' });
    }
});

// Update a comment
router.put('/:id', auth, async (req, res) => {
    try {
        const { content } = req.body;
        
        if (!content) {
            return res.status(400).json({ error: 'Content is required' });
        }
        
        const comment = await Comment.findById(req.params.id);
        
        if (!comment) {
            return res.status(404).json({ error: 'Comment not found' });
        }
        
        // Check if user owns the comment
        if (comment.author.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized to update this comment' });
        }
        
        comment.content = content;
        comment.isEdited = true;
        comment.updatedAt = new Date();
        
        await comment.save();
        
        const populatedComment = await Comment.findById(comment._id)
            .populate('author', 'username displayName avatar');
            
        res.json(populatedComment);
    } catch (error) {
        console.error('Error updating comment:', error);
        res.status(500).json({ error: 'Failed to update comment' });
    }
});

// Delete a comment
router.delete('/:id', auth, async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.id);
        
        if (!comment) {
            return res.status(404).json({ error: 'Comment not found' });
        }
        
        // Check if user owns the comment
        if (comment.author.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized to delete this comment' });
        }
        
        await Comment.findByIdAndDelete(req.params.id);
        
        res.json({ message: 'Comment deleted successfully' });
    } catch (error) {
        console.error('Error deleting comment:', error);
        res.status(500).json({ error: 'Failed to delete comment' });
    }
});

module.exports = router; 