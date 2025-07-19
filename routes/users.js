const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');
const optionalAuth = require('../middleware/optionalAuth');
const adminAuth = require('../middleware/adminAuth');
const mongoose = require('mongoose');

// Get online users
router.get('/online', auth, async (req, res) => {
    const ip = req.ip;
    const requesterId = req.user?.id || 'UnknownUser';
    console.log(`[USERS_ONLINE] Request received from UserID: ${requesterId}, IP: ${ip}`);
    try {
        const users = await User.find({ online: true, banned: { $ne: true } })
            .select('username displayName avatar status online lastLogin banned')
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
router.get('/', optionalAuth, async (req, res) => {
    const { page = 1, limit = 12, q = '' } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const ip = req.ip;
    const requesterId = req.user?.id || 'guest';
    console.log(`[USERS_ALL] Request for page ${page}, limit ${limit}, query '${q}' from UserID: ${requesterId}, IP: ${ip}`);
    
    try {
        const queryOptions = q 
            ? { 
                $or: [
                    { username: { $regex: q, $options: 'i' } },
                    { displayName: { $regex: q, $options: 'i' } }
                ]
            }
            : {};
        
        // Include banned field for admin users
        let selectFields = 'username displayName avatar status bio createdAt online lastLogin';
        
        // Check if user is admin to include sensitive fields
        if (req.user?.id) {
            try {
                const requester = await User.findById(req.user.id);
                if (requester && requester.role === 'admin') {
                    selectFields += ' banned role';
                    console.log(`[USERS_ALL] Admin access detected, including banned field for ${requester.username}`);
                }
            } catch (err) {
                console.log(`[USERS_ALL] Could not verify admin status: ${err.message}`);
            }
        }

        const users = await User.find(queryOptions)
            .select(selectFields)
            .skip(skip)
            .limit(parseInt(limit))
            .sort({ createdAt: -1 });
        
        const total = await User.countDocuments(queryOptions);
        
        console.log(`[USERS_ALL] Fetched ${users.length} users. Total matching query: ${total}.`);
        // Optionally log details of fetched users if needed for debugging this specific endpoint
        // users.forEach(u => {
        //     console.log(`  - User: ${u.username}, Online: ${u.online}, Status: '${u.status || 'N/A'}', Created: ${u.createdAt}`);
        // });

        // The frontend expects the array directly for the souls page.
        // We will send the array directly.
        res.json(users);
        
    } catch (error) {
        console.error(`[USERS_ALL ERROR] For UserID: ${requesterId}, IP: ${ip}:`, error.message, error.stack);
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
router.get('/:username', optionalAuth, async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username })
            .select('username displayName avatar status bio createdAt online');
        if (!user) {
            console.log(`User not found for username: ${req.params.username} from ${req.ip}`);
            return res.status(404).json({ error: 'User not found' });
        }
        console.log(`Fetched user ${req.params.username} for ${req.user?.id || 'guest'} from ${req.ip}`);
        res.json(user);
    } catch (error) {
        console.error(`Error fetching user ${req.params.username} from ${req.ip}:`, error.message, error.stack);
        res.status(500).json({ error: 'Server error' });
    }
});

// Update current user
router.patch('/me', auth, async (req, res) => {
    console.log(`[PATCH /api/users/me] Route hit. req.body:`, JSON.stringify(req.body));
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
        
        // Broadcast status update via WebSocket if status changed
        if (updates.status !== undefined) {
            console.log(`[STATUS_UPDATE] User ${req.user.id} status changed to: "${updates.status}"`);
            const wsManager = req.app.get('wsManager');
            if (wsManager) {
                console.log(`[STATUS_UPDATE] Broadcasting status update for user ${req.user.id}`);
                wsManager.broadcastUserStatus(req.user.id, updatedUser.online ? 'online' : 'offline');
            } else {
                console.error(`[STATUS_UPDATE] WebSocket manager not found!`);
            }
        }
        
        console.log(`User ${req.user.id} updated from ${req.ip}:`, updates);
        console.log(`Bio field in updates: ${updates.bio || 'undefined'}`);
        console.log(`Bio field in saved user: ${updatedUser.bio || 'undefined'}`);
        res.json(updatedUser);
    } catch (error) {
        console.error(`Error updating user ${req.user.id} from ${req.ip}:`, error.message, error.stack);
        res.status(500).json({ error: 'Server error' });
    }
});

// ADMIN ROUTE: Update user by ID or Username
router.put('/:identifier', auth, adminAuth, async (req, res) => {
    console.log('[PUT /api/users/:identifier] Route hit. req.user from auth middleware:', JSON.stringify(req.user));
    const { identifier } = req.params;
    const { displayName, email, status, bio, role, online, banned } = req.body;
    const ip = req.ip;
    const adminUserId = req.user.id;

    console.log(`[ADMIN_USER_UPDATE] Request by Admin ID: ${adminUserId} to update user: ${identifier} from IP: ${ip}`);
    console.log(`[ADMIN_USER_UPDATE] Received data:`, req.body);

    const allowedUpdates = {};
    if (displayName !== undefined) allowedUpdates.displayName = displayName;
    if (email !== undefined) allowedUpdates.email = email;
    if (status !== undefined) allowedUpdates.status = status;
    if (bio !== undefined) allowedUpdates.bio = bio;
    if (role !== undefined) allowedUpdates.role = role;
    if (online !== undefined && typeof online === 'boolean') allowedUpdates.online = online;
    if (banned !== undefined && typeof banned === 'boolean') allowedUpdates.banned = banned;

    if (Object.keys(allowedUpdates).length === 0) {
        console.log(`[ADMIN_USER_UPDATE] No updatable fields provided for user: ${identifier}`);
        return res.status(400).json({ error: 'No updatable fields provided' });
    }

    try {
        let userToUpdate;

        if (mongoose.Types.ObjectId.isValid(identifier)) {
            userToUpdate = await User.findById(identifier);
        }
        if (!userToUpdate) {
            userToUpdate = await User.findOne({ username: identifier });
        }

        if (!userToUpdate) {
            console.log(`[ADMIN_USER_UPDATE] User not found by identifier: ${identifier}`);
            return res.status(404).json({ error: 'User not found' });
        }

        console.log(`[ADMIN_USER_UPDATE] Found user: ${userToUpdate.username} (ID: ${userToUpdate._id}). Applying updates:`, allowedUpdates);

        if (allowedUpdates.email && allowedUpdates.email !== userToUpdate.email) {
            const existingUserWithEmail = await User.findOne({ email: allowedUpdates.email });
            if (existingUserWithEmail && existingUserWithEmail._id.toString() !== userToUpdate._id.toString()) {
                console.log(`[ADMIN_USER_UPDATE] Email "${allowedUpdates.email}" is already taken by another user.`);
                return res.status(400).json({ error: 'Email is already in use by another account.' });
            }
        }

        Object.assign(userToUpdate, allowedUpdates);
        await userToUpdate.save();

        const updatedUser = await User.findById(userToUpdate._id).select('-password -seed');
        
        // Broadcast status update via WebSocket if status or online state changed
        if (allowedUpdates.status !== undefined || allowedUpdates.online !== undefined) {
            const wsManager = req.app.get('wsManager');
            if (wsManager) {
                wsManager.broadcastUserStatus(userToUpdate._id.toString(), updatedUser.online ? 'online' : 'offline');
            }
        }

        console.log(`[ADMIN_USER_UPDATE] User ${userToUpdate.username} (ID: ${userToUpdate._id}) updated successfully by Admin ID: ${adminUserId}.`);
        res.json(updatedUser);

    } catch (error) {
        console.error(`[ADMIN_USER_UPDATE_ERROR] Updating user ${identifier} by Admin ${adminUserId}:`, error.message, error.stack);
        if (error.name === 'ValidationError') {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Server error while updating user' });
    }
});

// Delete user (Admin only)
router.delete('/:identifier', auth, adminAuth, async (req, res) => {
    const { identifier } = req.params;
    const adminUserId = req.user.id;
    
    console.log(`[ADMIN_USER_DELETE] Admin ${adminUserId} attempting to delete user: ${identifier}`);
    
    try {
        let userToDelete;
        
        // Find user by ID or username
        if (mongoose.Types.ObjectId.isValid(identifier)) {
            userToDelete = await User.findById(identifier);
        }
        if (!userToDelete) {
            userToDelete = await User.findOne({ username: identifier });
        }
        
        if (!userToDelete) {
            console.log(`[ADMIN_USER_DELETE] User not found by identifier: ${identifier}`);
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Prevent self-deletion
        if (userToDelete._id.toString() === adminUserId) {
            console.log(`[ADMIN_USER_DELETE] Admin ${adminUserId} attempted to delete themselves`);
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }
        
        const deletedUsername = userToDelete.username;
        const deletedUserId = userToDelete._id.toString();
        
        // Delete user
        await User.findByIdAndDelete(userToDelete._id);
        
        console.log(`[ADMIN_USER_DELETE] User ${deletedUsername} (ID: ${deletedUserId}) deleted successfully by Admin ID: ${adminUserId}`);
        
        // Note: Associated content (blogs, comments, etc.) will be orphaned
        // This is intentional to preserve content history
        
        res.json({ 
            message: 'User deleted successfully',
            deletedUser: {
                id: deletedUserId,
                username: deletedUsername
            }
        });
        
    } catch (error) {
        console.error(`[ADMIN_USER_DELETE_ERROR] Deleting user ${identifier} by Admin ${adminUserId}:`, error.message, error.stack);
        res.status(500).json({ error: 'Server error while deleting user' });
    }
});

module.exports = router;