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
      'http://localhost:3000',
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

// ======= User Schema =======
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  joined: { type: Date, default: Date.now },
  status: { type: String, default: 'Online' },
  avatar: { type: String, default: 'https://i.pravatar.cc/40' }
});

userSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  next();
});

const User = mongoose.model('User', userSchema);

// ======= Message Schema =======
const messageSchema = new mongoose.Schema({
  sender: { type: String, required: true },
  recipient: { type: String, required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message', messageSchema);

// ======= Authentication Middleware =======
const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    console.log('🔒 No token provided');
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = { id: decoded.userId, username: decoded.username };
    next();
  } catch (error) {
    console.error('🔒 Invalid token:', error.message);
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
    const token = jwt.sign({ userId: user._id, username }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '1h' });
    res.json({ token, message: 'Registration successful' });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(400).json({ error: 'Username already taken or invalid input' });
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
    await User.updateOne({ username }, { status: 'Online' });
    const token = jwt.sign({ userId: user._id, username }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '1h' });
    res.json({ token, message: 'Login successful' });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ error: 'Server error - please try again' });
  }
});

app.post('/api/auth/logout', authMiddleware, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { status: 'Offline' });
    res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Failed to logout' });
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
      author: req.user.id
    });
    await post.save();
    res.json({ post, message: 'Post created' });
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(400).json({ error: 'Post creation failed' });
  }
});

app.get('/api/posts', async (req, res) => {
  try {
    const posts = await Post.find().populate('author', 'username');
    res.json(posts);
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ error: 'Failed to retrieve posts' });
  }
});

// ======= Messaging Endpoints =======
app.get('/api/users/online', authMiddleware, async (req, res) => {
  try {
    console.log(`Fetching online users for ${req.user.username}`);
    const users = await User.find({ status: 'Online' }).select('username status avatar');
    res.json(users);
  } catch (error) {
    console.error('Error fetching online users:', error);
    res.status(500).json({ error: 'Failed to fetch online users' });
  }
});

app.post('/api/messages/send', authMiddleware, async (req, res) => {
  const { recipient, message } = req.body;
  if (!recipient || !message) {
    return res.status(400).json({ error: 'Recipient and message required' });
  }
  try {
    const recipientUser = await User.findOne({ username: recipient });
    if (!recipientUser) {
      return res.status(404).json({ error: 'Recipient not found' });
    }
    const newMessage = new Message({
      sender: req.user.username,
      recipient,
      message
    });
    await newMessage.save();
    res.json({ success: true, messageId: newMessage._id });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

app.get('/api/messages/history', authMiddleware, async (req, res) => {
  const { recipient } = req.query;
  if (!recipient) {
    return res.status(400).json({ error: 'Recipient required' });
  }
  try {
    const messages = await Message.find({
      $or: [
        { sender: req.user.username, recipient },
        { sender: recipient, recipient: req.user.username }
      ]
    }).sort({ timestamp: 1 });
    res.json(messages.map(msg => ({
      sender: msg.sender,
      message: msg.message,
      timestamp: msg.timestamp.toISOString()
    })));
  } catch (error) {
    console.error('Error fetching message history:', error);
    res.status(500).json({ error: 'Failed to fetch message history' });
  }
});

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

// ======= Server Initialization =======
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🌌 Server listening on port ${PORT}`);
});