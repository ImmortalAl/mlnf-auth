// index.js
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const chronicleRoutes = require('./routes/chronicles');
const threadsRoutes = require('./routes/threads');
const moderationRoutes = require('./routes/moderation');
const blogRoutes = require('./routes/blogs');
const profileRoutes = require('./routes/profileRoutes');
const messagesRoutes = require('./routes/messages');
const owlRoutes = require('./routes/owls');
const commentsRoutes = require('./routes/comments');
const cors = require('cors');
const http = require('http');
const WebSocketManager = require('./websocket');

// Load environment variables from .env file
dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://immortal:cN0VuntETXgV7xD1@mlnf-cluster.ctoehaf.mongodb.net/mlnf?retryWrites=true&w=majority', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
      console.error('MongoDB connection error:', err.message);
      process.exit(1);
  });

const app = express();

// Logging middleware (place early to see all requests)
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} from ${req.ip} (Origin: ${req.headers.origin})`);
    next();
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    optionsSuccessStatus: 204,
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/chronicles', chronicleRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/threads', threadsRoutes);
app.use('/api/moderation', moderationRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/comments', commentsRoutes);
app.use('/api', owlRoutes);

// --- Test & Health Routes ---
app.get('/ping', (req, res) => res.status(200).send('pong'));
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        uptime: process.uptime(),
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
    });
});

// Error Handling Middleware
app.use((err, req, res, next) => {
    console.error(`Error from ${req.ip} on ${req.method} ${req.originalUrl}:`, err.message, err.stack);
    res.status(500).json({ error: 'Internal server error' });
});

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket Manager
const wsManager = new WebSocketManager(server);

// Make WebSocket manager available to routes
app.set('wsManager', wsManager);

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
