```javascript
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const usersRouter = require('./routes/users');

const app = express();

// Ensure Uploads folder exists
const uploadsDir = path.join(__dirname, 'Uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
  console.log(`📁 Uploads folder created at: ${uploadsDir}`);
}

// CORS configuration
const allowedOrigins = [
  'https://mlnf.net',
  'https://dashing-belekoy-7a0095.netlify.app',
  'https://immortalal.github.io',
  'http://localhost:8080' // For local testing
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
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
app.use('/Uploads', express.static(uploadsDir));

// Routes
app.use('/api/users', usersRouter);

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('📚 MongoDB connected');
}).catch(err => {
  console.error('MongoDB connection error:', err.stack);
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
```