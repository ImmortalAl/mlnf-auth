const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const blogRoutes = require('./routes/blogs');
const notificationRoutes = require('./routes/notifications');
const activityRoutes = require('./routes/activity');
const debateRoutes = require('./routes/debates');
const mediaRoutes = require('./routes/media');
const messageRoutes = require('./routes/messages');
const mindmapRoutes = require('./routes/mindmap');
const newsRoutes = require('./routes/news');
const app = express();

// Use persistent disk path
const UPLOADS_DIR = '/opt/render/project/src/Uploads';
async function ensureUploadsFolder() {
  try {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    console.log('Uploads folder created at: ' + UPLOADS_DIR);
  } catch (error) {
    console.error('Failed to create Uploads folder: ' + error.message);
  }
}

// CORS configuration
const allowedOrigins = [
  'https://mlnf.net',
  'https://dashing-belekoy-7a0095.netlify.app',
  'https://immortalal.github.io',
  'http://localhost:3000',
  'http://localhost:8080',
  'http://127.0.0.1:3000'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('CORS error for origin: ' + origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Handle preflight requests
app.options('*', cors());

// Middleware
app.use(express.json());
app.use('/Uploads', express.static(UPLOADS_DIR));

// Log routes
app.use((req, res, next) => {
  console.log('Route accessed: ' + req.method + ' ' + req.path);
  next();
});

// Routes
console.log('Mounting routes...');
try {
  app.use('/api/auth', authRoutes);
  console.log('Mounted /api/auth');
  app.use('/api/users', userRoutes);
  console.log('Mounted /api/users');
  app.use('/api/blogs', blogRoutes);
  console.log('Mounted /api/blogs');
  app.use('/api/notifications', notificationRoutes);
  console.log('Mounted /api/notifications');
  app.use('/api/activity', activityRoutes);
  console.log('Mounted /api/activity');
  app.use('/api/debates', debateRoutes);
  console.log('Mounted /api/debates');
  app.use('/api/media', mediaRoutes);
  console.log('Mounted /api/media');
  app.use('/api/messages', messageRoutes);
  console.log('Mounted /api/messages');
  app.use('/api/mindmap', mindmapRoutes);
  console.log('Mounted /api/mindmap');
  app.use('/api/news', newsRoutes);
  console.log('Mounted /api/news');
} catch (error) {
  console.error('Error mounting routes:', error.message);
  throw error;
}

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error: ' + err.message));

// Initialize server
const PORT = process.env.PORT || 3001;
async function startServer() {
  await ensureUploadsFolder();
  app.listen(PORT, () => console.log('Server running on port ' + PORT));
}

startServer();