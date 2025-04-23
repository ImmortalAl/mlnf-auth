const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
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
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, origin || '*');
      } else {
        callback(new Error('CORS policy violation'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  })
);
app.options('*', cors());

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
      console.error('MongoDB connection error:', err.message);
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
  console.error('MongoDB connection error:', err.message);
});
mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected. Attempting to reconnect...');
  connectDB();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

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
    console.error('Health check error:', err.message);
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