const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users'); // If you have this file
require('dotenv').config();

const app = express();

// CORS configuration
const allowedOrigins = [
  'https://mlnf.net',
  'https://dashing-belekoy-7a0095.netlify.app',
  'https://immortalal.github.io',
  'http://localhost:3000',
  'http://localhost:8080',
  'http://127.0.0.1:3000',
];
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'Uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Uploads folder created at:', uploadsDir);
}
app.use('/uploads', express.static(uploadsDir));

// MongoDB connection
const connectDB = async () => {
  try {
    console.log('Attempting to connect to MongoDB with URI:', process.env.MONGO_URI.replace(/:([^@]+)@/, ':<hidden>@'));
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 15000, // Increase timeout
      maxPoolSize: 10, // Connection pooling
    });
    console.log('MongoDB connected successfully');
  } catch (err) {
    console.error('MongoDB connection error:', err.message, err.stack);
    process.exit(1);
  }
};
connectDB();

// Routes
app.use('/api/auth', authRoutes);
// app.use('/api/users', userRoutes); // Uncomment if you have user routes

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error:', err.message, err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});