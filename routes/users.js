const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure multer with Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'mlnf_avatars',
    allowed_formats: ['jpg', 'png', 'jpeg'],
    transformation: [{ width: 200, height: 200, crop: 'fill' }]
  }
});
const upload = multer({
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB limit
});

// Get current user
router.get('/me', auth, async (req, res) => {
  try {
    console.log('GET /api/users/me - User ID:', req.user.id);
    const user = await User.findById(req.user.id).select('-password -seed');
    if (!user) {
      console.log('User not found for ID:', req.user.id);
      return res.status(404).json({ error: 'User not found' });
    }
    console.log('User data sent:', user);
    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all online users
router.get('/', auth, async (req, res) => {
  try {
    const users = await User.find({ online: true }).select('-password -seed');
    console.log('GET /api/users - Online users:', users.length);
    res.json(users);
  } catch (error) {
    console.error('Get online users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user by ID
router.get('/:id', auth, async (req, res) => {
  try {
    console.log('GET /api/users/:id - ID:', req.params.id);
    const user = await User.findById(req.params.id).select('-password -seed');
    if (!user) {
      console.log('User not found for ID:', req.params.id);
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update user profile
router.put('/profile', auth, upload.single('avatar'), async (req, res) => {
  try {
    console.log('PUT /api/users/profile - User ID:', req.user.id);
    console.log('Request body:', req.body);
    console.log('File:', req.file);
    const { displayName, bio, status } = req.body;
    const updateData = {};
    if (displayName) updateData.displayName = displayName;
    if (bio) updateData.bio = bio;
    if (status) updateData.status = status;
    if (req.file) {
      updateData.avatar = req.file.path;
      console.log('Avatar uploaded to Cloudinary:', req.file.path);
    }
    console.log('Update data:', updateData);
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).select('-password -seed');
    if (!user) {
      console.log('User not found for ID:', req.user.id);
      return res.status(404).json({ error: 'User not found' });
    }
    console.log('Updated user:', user);
    res.json(user);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: `Server error: ${error.message}` });
  }
});

module.exports = router;