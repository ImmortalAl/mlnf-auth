const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const User = require('models/user');
const auth = require('../middleware/auth');

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const ip = req.ip;
    try {
        if (!username || !password) {
            console.log(`[LOGIN ATTEMPT] Failed: Missing credentials from ${ip}`);
            return res.status(400).json({ error: 'Username and password are required' });
        }
        const user = await User.findOne({ username });
        if (!user) {
            console.log(`[LOGIN ATTEMPT] Failed: User not found for username: ${username} from ${ip}`);
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.log(`[LOGIN ATTEMPT] Failed: Incorrect password for username: ${username} from ${ip}`);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Update online status and lastLogin time
        console.log(`[LOGIN] User ${username} found. Current online status: ${user.online}. Attempting to set online: true and update lastLogin.`);
        const updatedUser = await User.findByIdAndUpdate(
            user._id,
            { online: true, lastLogin: new Date() }, // Set online and update lastLogin
            { new: true } // Return the updated document
        ).select('-password -seed'); // Exclude sensitive fields

        if (!updatedUser) {
            console.error(`[LOGIN CRITICAL] Failed to update user ${username} to online: true and set lastLogin from ${ip}. User might appear offline.`);
            // Even if update fails, proceed with login but log critical error
            const token = await jwt.sign({ id: user._id, username }, process.env.JWT_SECRET, { expiresIn: '30d' });
            return res.json({ token, user: user.toObject({ getters: true, versionKey: false, transform: (doc, ret) => { delete ret.password; delete ret.seed; return ret; } }) });
        }
        
        console.log(`[LOGIN SUCCESS] User: ${updatedUser.username}, Online: ${updatedUser.online}, LastLogin: ${updatedUser.lastLogin}, IP: ${ip}`);
        const token = await jwt.sign({ id: updatedUser._id, username: updatedUser.username }, process.env.JWT_SECRET, { expiresIn: '30d' });
        res.json({ token, user: updatedUser });

    } catch (error) {
        console.error(`[LOGIN ERROR] For ${username} from ${ip}:`, error.message, error.stack);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/signup', async (req, res) => {
    const { username, password } = req.body;
    try {
        if (!username || !password) {
            console.log(`Signup failed: Missing credentials from ${req.ip}`);
            return res.status(400).json({ error: 'Username and password are required' });
        }
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            console.log(`Signup failed: Username taken: ${username} from ${req.ip}`);
            return res.status(400).json({ error: 'Username taken' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ username, password: hashedPassword, online: true });
        await user.save();
        const token = await jwt.sign({ id: user._id, username }, process.env.JWT_SECRET, { expiresIn: '1h' });
        const safeUser = user.toObject({
            getters: true,
            versionKey: false,
            transform: (doc, ret) => {
                delete ret.password;
                delete ret.seed;
                return ret;
            }
        });
        console.log(`Signup successful for username: ${username} from ${req.ip}`);
        res.json({ token, user: safeUser });
    } catch (error) {
        console.error(`Signup error for ${username || 'unknown'} from ${req.ip}:`, error.message, error.stack);
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/logout', auth, async (req, res) => {
    try {
        const updatedUser = await User.findByIdAndUpdate(
            req.user.id,
            { online: false },
            { new: true }
        );
        if (!updatedUser) {
            console.warn(`Failed to set offline status for user ID: ${req.user.id} from ${req.ip}`);
            return res.status(404).json({ error: 'User not found' });
        }
        console.log(`Logout successful for user ID: ${req.user.id} from ${req.ip}`);
        res.json({ message: 'Logout successful' });
    } catch (error) {
        console.error(`Logout error for user ID: ${req.user.id} from ${req.ip}:`, error.message, error.stack);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;