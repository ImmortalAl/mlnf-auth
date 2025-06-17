const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const threadsRoutes = require('./routes/threads');
const moderationRoutes = require('./routes/moderation');
const blogRoutes = require('./routes/blogs');
const chronicleRoutes = require('./routes/chronicles');
const profileRoutes = require('./routes/profileRoutes');
const messagesRoutes = require('./routes/messages');
const owlRoutes = require('./routes/owls');
const commentsRoutes = require('./routes/comments');
const newsRoutes = require('./routes/news');
const http = require('http');
const WebSocketManager = require('./websocket');

const app = express();
const PORT = process.env.PORT || 3001;

const corsOptions = {
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    optionsSuccessStatus: 204,
    allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'Pragma']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Logging middleware (place early to see all requests)
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} from ${req.ip} (Origin: ${req.headers.origin})`);
    next();
});

// Middleware
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Atlas Connection
const mongoUri = process.env.MONGO_URI || 'mongodb+srv://immortal:cN0VuntETXgV7xD1@mlnf-cluster.ctoehaf.mongodb.net/mlnf?retryWrites=true&w=majority';
mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log('Connected to MongoDB Atlas');
}).catch((error) => {
    console.error('MongoDB connection error:', error.message, error.stack);
    process.exit(1); // Exit if MongoDB connection fails
});

// --- Test Route ---
app.get('/ping', (req, res) => {
    res.status(200).send('pong');
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/chronicles', chronicleRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/threads', threadsRoutes);
app.use('/api/moderation', moderationRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/comments', commentsRoutes);
app.use('/api', owlRoutes);
app.use('/api/news', newsRoutes);

// Health Check Endpoint
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

// Start Server
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});