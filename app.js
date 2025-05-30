const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const threadsRoutes = require('./routes/threads');
const moderationRoutes = require('./routes/moderation');
const blogRoutes = require('./routes/blogs');
const profileRoutes = require('./routes/profileRoutes');
const messagesRoutes = require('./routes/messages');
const http = require('http');
const WebSocketManager = require('./websocket');

const app = express();
const PORT = process.env.PORT || 3001;

// Define allowed origins
const allowedOrigins = [
    'https://dashing-belekoy-7a0095.netlify.app',
    'https://mlnf.net',
    'https://immortalal.github.io',
    'http://localhost:3000', // For local testing
    'http://127.0.0.1:5500' // Common local alias, just in case
];

const corsOptions = {
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.warn(`CORS: Blocked origin - ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true,
    optionsSuccessStatus: 204 // Explicitly set 204 for OPTIONS success
};

// Apply CORS middleware globally for all routes
app.use(cors(corsOptions));

// Explicitly handle preflight requests for all routes
// This should come AFTER the main cors middleware if that middleware sets preflightContinue: true (which it isn't here)
// or can be used as a more direct handler.
app.options('*', cors(corsOptions)); // Ensures OPTIONS requests get a 204 with correct headers

/* // REMOVING/COMMENTING OUT this explicit OPTIONS handler for now
// Explicitly handle OPTIONS pre-flight requests
app.options('*', cors(), (req, res) => {
    console.log(`Received OPTIONS request from ${req.ip} for ${req.originalUrl}`);
    res.status(204).send();
});
*/

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

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/threads', threadsRoutes);
app.use('/api/moderation', moderationRoutes);
app.use('/api/messages', messagesRoutes);

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