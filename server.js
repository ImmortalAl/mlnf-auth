constBlogpostconst express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const morgan = require('morgan');

dotenv.config();

const app = express();

// CORS configuration
const corsOptions = {
    origin: ['https://mlnf.net', 'https://dashing-belekoy-7a0095.netlify.app', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
    optionsSuccessStatus: 200
};

// Middleware
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(morgan('dev')); // Request logging
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Debug CORS headers
app.use((req, res, next) => {
    console.log(`Request: ${req.method} ${req.url} from ${req.get('Origin') || 'unknown'}`);
    res.on('finish', () => {
        console.log(`Response: ${req.method} ${req.url} - Status: ${res.statusCode}`);
    });
    next();
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/blogs', require('./routes/blogs'));

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('MongoDB connected successfully');
}).catch(err => {
    console.error('MongoDB connection error:', err);
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});