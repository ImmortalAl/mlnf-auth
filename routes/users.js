const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');

// Get online users
router.get('/online', auth, async (req, res) => {
    const ip = req.ip;
    const requesterId = req.user?.id || 'UnknownUser';
    console.log(`[USERS_ONLINE] Request received from UserID: ${requesterId}, IP: ${ip}`);
    try {
        const users = await User.find({ online: true })
            .select('username displayName avatar status online lastLogin')
            .sort({ username: 1 });
        
        console.log(`[USERS_ONLINE] Found ${users.length} online users. Data being sent:`);
        users.forEach(u => {
            console.log(`  - User: ${u.username}, Online: ${u.online}, Status: '${u.status || 'N/A'}', LastLogin: ${u.lastLogin}`);
        });
        
        const requestingUserInfo = users.find(u => u._id.toString() === requesterId);
        if (requestingUserInfo) {
            console.log(`[USERS_ONLINE] Requesting user ${requestingUserInfo.username} (ID: ${requesterId}) IS in the online list. Online: ${requestingUserInfo.online}, Status: '${requestingUserInfo.status || 'N/A'}'`);
        } else {
            console.log(`[USERS_ONLINE] Requesting user ID: ${requesterId} IS NOT in the fetched online list.`);
            const currentUserFromDB = await User.findById(requesterId).select('username online status lastLogin');
            if (currentUserFromDB) {
                console.log(`[USERS_ONLINE] Current DB state for ${currentUserFromDB.username} (ID: ${requesterId}): Online: ${currentUserFromDB.online}, Status: '${currentUserFromDB.status || 'N/A'}', LastLogin: ${currentUserFromDB.lastLogin}`);
            }
        }

        res.json(users);
    } catch (error) {
        console.error(`[USERS_ONLINE ERROR] For UserID: ${requesterId}, IP: ${ip}:`, error.message, error.stack);
        res.status(500).json({ error: 'Failed to fetch online users' });
    }
});

// Get all users with pagination
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

// Get current user
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

// Get user by username
router.get('/:username', auth, async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username })
            .select('username displayName avatar status bio createdAt online');
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

// Update current user
router.patch('/me', auth, async (req, res) => {
    const { username, displayName, avatar, status, bio } = req.body;
    const updates = { username, displayName, avatar, status, bio };
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

        if (bio && bio.length > 500) {
            console.log(`Bio too long: ${bio.length} characters from ${req.ip}`);
            return res.status(400).json({ error: 'Bio must be less than 500 characters' });
        }

        Object.assign(user, updates);
        await user.save();
        const updatedUser = await User.findById(req.user.id).select('-password -seed');
        console.log(`User ${req.user.id} updated from ${req.ip}:`, updates);
        console.log(`Bio field in updates: ${updates.bio || 'undefined'}`);
        console.log(`Bio field in saved user: ${updatedUser.bio || 'undefined'}`);
        res.json(updatedUser);
    } catch (error) {
        console.error(`Error updating user ${req.user.id} from ${req.ip}:`, error.message, error.stack);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;