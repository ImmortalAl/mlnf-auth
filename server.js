require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// ======= Security Middleware =======
app.use(helmet());
app.set('trust proxy', 1);

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit requests per IP
  message: 'Too many authentication attempts - try again later'
});
app.use('/api/auth', process.env.NODE_ENV === 'production' ? authLimiter : (req, res, next) => next());

// ======= CORS Configuration =======
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://mlnf.net',              // Your future custom domain
      'https://mlnf-yourname.netlify.app', // Placeholder: Replace with your Netlify URL
      'http://localhost:3000',         // Local dev
      'http://127.0.0.1:3000',         // Local dev alternative
      'http://localhost',              // Catch-all local
      'http://127.0.0.1'               // Catch-all local alternative
    ];
    console.log('Request Origin:', origin); // Debug log for deployment
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
app.use(cors(corsOptions)); // Removed duplicate cors line

// ======= Body Parsing =======
app.use(express.json());

// ======= Database Connection =======
const mongoURI = process.env.MONGO_URI; // Rely solely on env var in production
mongoose.connect(mongoURI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000
})
  .then(() => console.log('🌀 Connected to Eternal Database'))
  .catch(err => console.error('💀 Database connection failed:', err));

// ======= User Schema =======
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  joined: { type: Date, default: Date.now }
});

userSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  next();
});

const User = mongoose.model('User', userSchema);

// ======= Authentication Middleware =======
const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// ======= Authentication Routes =======
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  try {
    const user = new User({ username, password });
    await user.save();
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, message: 'Registration successful' });
  } catch (error) {
    res.status(400).json({ error: 'Registration failed: ' + error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  try {
    const user = await User.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, message: 'Login successful' });
  } catch (error) {
    res.status(500).json({ error: 'Login failed: ' + error.message });
  }
});

// ======= Community Features =======
const postSchema = new mongoose.Schema({
  content: { type: String, required: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  timestamp: { type: Date, default: Date.now }
});

const Post = mongoose.model('Post', postSchema);

app.post('/api/posts', authMiddleware, async (req, res) => {
  try {
    const post = new Post({
      content: req.body.content,
      author: req.userId
    });
    await post.save();
    res.json({ post, message: 'Post created' });
  } catch (error) {
    res.status(400).json({ error: 'Post creation failed: ' + error.message });
  }
});

app.get('/api/posts', async (req, res) => {
  try {
    const posts = await Post.find().populate('author', 'username');
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve posts: ' + error.message });
  }
});

// ======= Health Check Endpoint =======
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is alive' });
});

// ======= HTTPS Enforcement =======
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && req.headers['x-forwarded-proto'] !== 'https') {
    return res.redirect(`https://${req.headers.host}${req.url}`);
  }
  next();
});

// ======= Server Initialization =======
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🌌 Server listening on port ${PORT}`);
});