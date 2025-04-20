// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises; // For folder creation
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const blogRoutes = require('./routes/blogs'); // For lander.html
const app = express();

// Create Uploads folder
const UPLOADS_DIR = '/opt/render/project/src/Uploads'; // Matches users.js
async function ensureUploadsFolder() {
  try {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    console.log('📁 Uploads folder created at:', UPLOADS_DIR);
  } catch (error) {
    console.error('❌ Failed to create Uploads folder:', error.message);
  }
}

// Middleware
app.use(cors({
  origin: [
    'https://mlnf-auth.onrender.com',
    'https://mlnf-frontend.onrender.com',
    'https://mlnf.net',
    'https://dashing-belekoy-7a0095.netlify.app',
    'https://immortalal.github.io',
    'http://localhost:3000',
    'http://localhost:8080',
    'http://127.0.0.1:3000'
  ],
  credentials: true
}));
app.use(express.json());
app.use('/Uploads', express.static(UPLOADS_DIR)); // Serve Uploads statically

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/blogs', blogRoutes);

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('📚 MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Initialize server
const PORT = process.env.PORT || 3001;
async function startServer() {
  await ensureUploadsFolder(); // Create Uploads before starting
  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
}

startServer();