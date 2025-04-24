const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
    const { page = 1, limit = 12, q = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    try {
        const query = q 
            ? { 
                $or: [
                    { username: { $regex: q, $options: 'i' } },
                    { displayName: { $regex: q, $options: 'i' } }
                ]
            }
            : {};
        
        const users = await User.find(query)
            .select('username displayName avatar status bio createdAt')
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 });
        
        const total = await User.countDocuments(query);
        
        console.log(`Fetched ${users.length} users (page ${page}, limit ${limit}, query: ${q}) for ${req.user.id} from ${req.ip}`);
        res.json({
            users,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error(`Error fetching users from ${req.ip}:`, error.message, error.stack);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

router.get('/me', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password -seed');
        if (!user) {
            console.log(`User not found for ID: ${req.user.id} from ${req.ip}`);
            return res.status(404).json({ error: 'User not found' });
        }
        console.log(`Fetched user ${req.user.id} from ${req.ip}`);
        res.json(user);
    } catch (error) {
        console.error(`Error fetching user ${req.user.id} from ${req.ip}:`, error.message, error.stack);
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/:username', auth, async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username })
            .select('username displayName avatar status bio createdAt');
        if (!user) {
            console.log(`User not found for username: ${req.params.username} from ${req.ip}`);
            return res.status(404).json({ error: 'User not found' });
        }
        console.log(`Fetched user ${req.params.username} for ${req.user.id} from ${req.ip}`);
        res.json(user);
    } catch (error) {
        console.error(`Error fetching user ${req.params.username} from ${req.ip}:`, error.message, error.stack);
        res.status(500).json({ error: 'Server error' });
    }
});

router.patch('/me', auth, async (req, res) => {
    const { username, displayName, avatar, status } = req.body;
    const updates = { username, displayName, avatar, status };
    Object.keys(updates).forEach(key => updates[key] === undefined && delete updates[key]);

    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            console.log(`User not found for ID: ${req.user.id} from ${req.ip}`);
            return res.status(404).json({ error: 'User not found' });
        }

        if (username && username !== user.username) {
            const existingUser = await User.findOne({ username });
            if (existingUser && existingUser._id.toString() !== user._id.toString()) {
                console.log(`Username taken: ${username} from ${req.ip}`);
                return res.status(400).json({ error: 'Username taken' });
            }
        }

        if (avatar) {
            try {
                new URL(avatar);
            } catch {
                console.log(`Invalid avatar URL: ${avatar} from ${req.ip}`);
                return res.status(400).json({ error: 'Invalid avatar URL' });
            }
        }

        Object.assign(user, updates);
        await user.save();
        const updatedUser = await User.findById(req.user.id).select('-password -seed');
        console.log(`User ${req.user.id} updated from ${req.ip}:`, updates);
        res.json(updatedUser);
    } catch (error) {
        console.error(`Error updating user ${req.user.id} from ${req.ip}:`, error.message, error.stack);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;