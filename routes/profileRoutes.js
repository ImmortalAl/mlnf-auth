const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');

// Get user profile
router.get('/', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password -seed');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update user profile
router.patch('/', auth, async (req, res) => {
    console.log(`[PATCH /api/profile] Route hit. req.body:`, JSON.stringify(req.body));
    try {
        const updates = {};
        
        // Validate and sanitize inputs
        if (req.body.username) {
            updates.username = req.body.username.trim();
            if (updates.username.length < 3 || updates.username.length > 30) {
                return res.status(400).json({ error: 'Username must be between 3 and 30 characters' });
            }
        }

        if (req.body.displayName) {
            updates.displayName = req.body.displayName.trim();
            if (updates.displayName.length > 50) {
                return res.status(400).json({ error: 'Display name must be less than 50 characters' });
            }
        }

        if (req.body.avatar) {
            updates.avatar = req.body.avatar.trim();
            // Basic URL validation
            try {
                new URL(req.body.avatar);
            } catch {
                return res.status(400).json({ error: 'Invalid avatar URL' });
            }
        }

        if (req.body.status) {
            updates.status = req.body.status.trim();
            if (updates.status.length > 100) {
                return res.status(400).json({ error: 'Status must be less than 100 characters' });
            }
        }

        if (req.body.bio) {
            updates.bio = req.body.bio.trim();
            if (updates.bio.length > 500) {
                return res.status(400).json({ error: 'Bio must be less than 500 characters' });
            }
        }

        // Update user
        const user = await User.findByIdAndUpdate(
            req.user.id,
            updates,
            { new: true, runValidators: true }
        ).select('-password -seed');

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Broadcast status update via WebSocket if status changed
        if (updates.status !== undefined) {
            console.log(`[PROFILE_STATUS_UPDATE] User ${req.user.id} status changed to: "${updates.status}"`);
            const wsManager = req.app.get('wsManager');
            if (wsManager) {
                console.log(`[PROFILE_STATUS_UPDATE] Broadcasting status update for user ${req.user.id}`);
                wsManager.broadcastUserStatus(req.user.id, user.online ? 'online' : 'offline');
            } else {
                console.error(`[PROFILE_STATUS_UPDATE] WebSocket manager not found!`);
            }
        }

        res.json(user);
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
