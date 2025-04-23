```javascript
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username }).catch((err) => {
      console.error('Error in findOne during login:', err.message);
      throw err;
    });
    if (!user) {
      console.log('Login failed: User not found for username:', username);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log('Login failed: Incorrect password for username:', username);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      { online: true },
      { new: true }
    ).select('-password -seed');
    if (!updatedUser) {
      console.warn('Failed to set online status for user:', username);
    }
    const token = jwt.sign({ id: user._id, username }, process.env.JWT_SECRET, { expiresIn: '1h' });
    console.log('Login successful for username:', username, 'Online:', updatedUser.online);
    res.json({ token, user: updatedUser });
  } catch (error) {
    console.error('Login error:', error.message, error.stack);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/signup', async (req, res) => {
  try {
    const { username, password } = req.body;
    const existingUser = await User.findOne({ username }).catch((err) => {
      console.error('Error in findOne during signup:', err.message);
      throw err;
    });
    if (existingUser) {
      console.log('Signup failed: Username taken:', username);
      return res.status(400).json({ error: 'Username taken' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, password: hashedPassword, online: true });
    await user.save();
    const token = jwt.sign({ id: user._id, username }, process.env.JWT_SECRET, { expiresIn: '1h' });
    console.log('Signup successful for username:', username);
    res.json({
      token,
      user: user.toObject({
        getters: true,
        versionKey: false,
        transform: (doc, ret) => {
          delete ret.password;
          delete ret.seed;
          return ret;
        }
      })
    });
  } catch (error) {
    console.error('Signup error:', error.message, error.stack);
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
      console.warn('Failed to set offline status for user ID:', req.user.id);
      return res.status(404).json({ error: 'User not found' });
    }
    console.log('Logout successful for user ID:', req.user.id);
    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
```