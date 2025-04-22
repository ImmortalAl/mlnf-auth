const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const authRoutes = require('./routes/auth');
const User = require('./models/User');
require('dotenv').config();

const app = express();

// CORS configuration
const allowedOrigins = [
  'https://mlnf.net',
  'https://dashing-belekoy-7a0095.netlify.app',
  'https://immortalal.github.io',
  'http://localhost:3000',
  'http://localhost:8080',
  'http://127.0.0.1:3000'
];

app.use(
  cors({
    origin: (origin, callback) => {
      console.log('CORS Origin:', origin);
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, origin || '*');
      } else {
        callback(new Error('CORS policy violation'));
      }
    },
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  })
);
app.options('*', cors());

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'Uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(UploadsDir, { recursive: true });
  console.log('Uploads folder created at:', uploadsDir);
}
app.use('/uploads', express.static(uploadsDir));

// MongoDB connection with retry logic
const connectDB = async () => {
  let retries = 5;
  while (retries) {
    try {
      console.log('Attempting to connect to MongoDB with URI:', process.env.MONGO_URI?.replace(/:([^@]+)@/, ':<hidden>@'));
      await mongoose.connect(process.env.MONGO_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        serverSelectionTimeoutMS: 30000,
        maxPoolSize: 10,
        connectTimeoutMS: 30000,
        socketTimeoutMS: 45000
      });
      console.log('MongoDB connected successfully');
      break;
    } catch (err) {
      console.error('MongoDB connection error:', err.message, err.stack);
      retries -= 1;
      console.log(`Retries left: ${retries}`);
      if (retries === 0) {
        console.error('Failed to connect to MongoDB after retries. Server will run without DB.');
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
};
connectDB();

// MongoDB connection events
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err.message, err.stack);
});
mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected. Attempting to reconnect...');
  connectDB();
});

// Routes
app.use('/api/auth', authRoutes);

app.get('/api/users/me', authenticateToken, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.user.id)) {
      console.error('Invalid user ID:', req.user.id);
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    const user = await User.findById(req.user.id).select('-password -seed');
    if (!user) {
      console.warn('User not found for ID:', req.user.id);
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Get user error:', {
      message: error.message,
      stack: error.stack,
      userId: req.user.id
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.patch('/api/users/me', authenticateToken, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.user.id)) {
      console.error('Invalid user ID:', req.user.id);
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    const updates = req.body;
    const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true }).select('-password -seed');
    if (!user) {
      console.warn('User not found for ID:', req.user.id);
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Update user error:', {
      message: error.message,
      stack: error.stack,
      userId: req.user.id
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db.admin().ping();
      res.json({ status: 'ok', mongodb: 'connected' });
    } else {
      res.json({ status: 'ok', mongodb: 'disconnected' });
    }
  } catch (err) {
    console.error('Health check error:', err.message, err.stack);
    res.status(500).json({ status: 'error', mongodb: 'disconnected', error: err.message });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error:', {
    message: err.message,
    stack: err.stack,
    path: req.path
  });
  if (err.message === 'CORS policy violation') {
    return res.status(403).json({ error: 'CORS policy violation' });
  }
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    console.warn('No token provided for request:', req.path);
    return res.status(401).json({ error: 'No token provided' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      console.error('JWT verification error:', {
        message: err.message,
        stack: err.stack,
        token: token.substring(0, 10) + '...'
      });
      return res.status(403).json({ error: 'Invalid token' });
    }
    console.log('JWT verified, user:', user);
    req.user = user;
    next();
  });
}