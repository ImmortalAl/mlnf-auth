const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const threadsRoutes = require('./routes/threads');
const moderationRoutes = require('./routes/moderation');
const blogRoutes = require('./routes/blogRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

// Enhanced CORS configuration
app.use(cors({
    origin: [
        'https://dashing-belekoy-7a0095.netlify.app',
        'https://mlnf.net',
        'https://immortalal.github.io',
        'http://localhost:3000' // For local testing
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    preflightContinue: false,
    optionsSuccessStatus: 204
}));

// Explicitly handle OPTIONS pre-flight requests
app.options('*', cors(), (req, res) => {
    console.log(`Received OPTIONS request from ${req.ip} for ${req.originalUrl}`);
    res.status(204).send();
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
app.use('/api/users', usersRoutes);
app.use('/api/threads', threadsRoutes);
app.use('/api/moderation', moderationRoutes);

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

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

// Log all incoming requests for debugging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} from ${req.ip}`);
    next();
});