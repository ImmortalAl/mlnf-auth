// server.js (backend: mlnf-auth)
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
// ... other imports

const app = express();

// Define allowed origins
const allowedOrigins = [
  'https://dashing-belekoy-7a0095.netlify.app',
  'https://immortalal.github.io',
  'https://mlnf.net',
  'http://localhost:3000' // For local development
];

// CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g., mobile apps or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'], // Explicitly allow PATCH and other methods
  allowedHeaders: ['Content-Type', 'Authorization'], // Allow necessary headers
  credentials: true, // If cookies or auth headers are used
  optionsSuccessStatus: 200 // For legacy browsers
}));

// Middleware
app.use(express.json());
app.use(morgan('dev'));

// Routes
// ... your existing routes (e.g., /api/users, /api/auth, /api/blogs)

// Handle preflight requests explicitly (optional, as cors middleware should handle this)
app.options('*', cors());

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => console.error('MongoDB connection error:', err));