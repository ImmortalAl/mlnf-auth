const express = require('express');
const multer = require('multer');
const authMiddleware = require('../middleware/auth');
const Media = require('../models/Media');
const router = express.Router();

// Multer setup for video uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) cb(null, true);
    else cb(new Error('Invalid file type'), false);
  }
});

// Upload video
router.post('/', authMiddleware, upload.single('video'), async (req, res) => {
  try {
    const { title } = req.body;
    if (!title || !req.file) {
      return res.status(400).json({ error: 'Title and video file required' });
    }
    const media = new Media({
      title,
      url: `/uploads/${req.file.filename}`,
      uploader: req.user.id
    });
    await media.save();
    res.status(201).json({ message: 'Video uploaded', media });
  } catch (error) {
    console.error('Error uploading video:', error);
    res.status(500).json({ error: 'Failed to upload video' });
  }
});

// Get all videos
router.get('/', async (req, res) => {
  try {
    const media = await Media.find().populate('uploader', 'username displayName').sort({ createdAt: -1 });
    res.json(media);
  } catch (error) {
    console.error('Error fetching videos:', error);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
});

module.exports = router;