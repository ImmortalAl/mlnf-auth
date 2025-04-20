const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

const UPLOADS_DIR = '/opt/render/project/src/Uploads';
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Get current user
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Fetch user error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update profile
router.put('/profile', authMiddleware, upload.single('avatar'), async (req, res) => {
  try {
    const updateData = {};
    if (req.body.displayName) updateData.displayName = req.body.displayName;
    if (req.body.bio) updateData.bio = req.body.bio;
    if (req.body.status) updateData.status = req.body.status;
    if (req.file) {
      updateData.avatar = `https://mlnf-auth.onrender.com/Uploads/${req.file.filename}`;
      console.log('Avatar uploaded:', updateData.avatar);
    }
    const user = await User.findByIdAndUpdate(req.user.id, updateData, { new: true }).select('-password');
    res.json(user);
  } catch (error) {
    console.error('Update profile error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get online users
router.get('/online', authMiddleware, async (req, res) => {
  try {
    const users = await User.find({ status: 'online' }).select('username displayName avatar status');
    res.json(users);
  } catch (error) {
    console.error('Fetch online users error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;