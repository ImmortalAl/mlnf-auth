require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const multer = require('multer');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const messageRoutes = require('./routes/messages');
const blogRoutes = require('./routes/blogs');
const debateRoutes = require('./routes/debates');
const mindmapRoutes = require('./routes/mindmap');
const mediaRoutes = require('./routes/media');
const newsRoutes = require('./routes/news');

const app = express();

// ======= Security Middleware =======
app.use(helmet());
app.set('trust proxy', 1);

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: 'Too many authentication attempts - try again later'
});
app.use('/api/auth', process.env.NODE_ENV === 'production' ? authLimiter : (req, res, next) => next());

// ======= CORS Configuration =======
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://mlnf-auth.onrender.com',
      'https://mlnf-frontend.onrender.com',
      'https://mlnf.net',
      'https://dashing-belekoy-7a0095.netlify.app',
      'https://immortalal.github.io',
      'http://localhost:3000',
      'http://localhost:8080',
      'http://127.0.0.1:3000'
    ];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 204
};
app.use(cors(corsOptions));

// Handle CORS errors gracefully
app.use((err, req, res, next) => {
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS policy violation' });
  }
  next(err);
});

// ======= Body Parsing =======
app.use(express.json());

// ======= File Uploads =======
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ======= Request Logging =======
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ======= Database Connection =======
const mongoURI = process.env.MONGO_URI;
if (!mongoURI) {
  console.error('💀 MONGO_URI not set');
  process.exit(1);
}
mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  autoIndex: true,
  maxPoolSize: 10,
  socketTimeoutMS: 45000,
  family: 4
})
  .then(() => console.log('🌀 Connected to Eternal Database'))
  .catch(err => {
    console.error('💀 Database connection failed:', err);
    process.exit(1);
  });

// Handle MongoDB reconnection
mongoose.connection.on('disconnected', () => {
  console.log('🌀 MongoDB disconnected, attempting to reconnect...');
  mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000
  });
});

// ======= Routes =======
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/debates', debateRoutes);
app.use('/api/mindmap', mindmapRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/news', newsRoutes);

// ======= Health Check Endpoint =======
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is alive' });
});

// ======= Fallback Route =======
app.use((req, res) => {
  console.log(`Route not found: ${req.method} ${req.url}`);
  res.status(404).json({ error: `Cannot ${req.method} ${req.url}` });
});

// ======= HTTPS Enforcement =======
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(`https://${req.headers.host}${req.url}`);
  }
  next();
});

// ======= Error Handling =======
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// ======= Server Initialization =======
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🌌 Server listening on port ${PORT}`);
});