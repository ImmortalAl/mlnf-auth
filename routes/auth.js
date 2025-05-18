const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        if (!username || !password) {
            console.log(`Login failed: Missing credentials from ${req.ip}`);
            return res.status(400).json({ error: 'Username and password are required' });
        }
        const user = await User.findOne({ username });
        if (!user) {
            console.log(`Login failed: User not found for username: ${username} from ${req.ip}`);
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.log(`Login failed: Incorrect password for username: ${username} from ${req.ip}`);
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const updatedUser = await User.findByIdAndUpdate(
            user._id,
            { online: true },
            { new: true }
        ).select('-password -seed');
        if (!updatedUser) {
            console.warn(`Failed to set online status for user: ${username} from ${req.ip}`);
        }
        const token = await jwt.sign({ id: user._id, username }, process.env.JWT_SECRET, { expiresIn: '30d' });
        console.log(`Login successful for username: ${username}, Online: ${updatedUser?.online}, IP: ${req.ip}`);
        res.json({ token, user: updatedUser });
    } catch (error) {
        console.error(`Login error for ${username} from ${req.ip}:`, error.message, error.stack);
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
        const email = `${username}@mlnf.net`;
        const user = new User({ username, email, password: hashedPassword, online: true });
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