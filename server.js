const express = require('express');
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

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
    console.log(`Request: ${req.method} ${req.url} from ${req.get('Origin') || 'unknown'} with headers: ${JSON.stringify(req.headers)}`);
    res.on('finish', () => {
        console.log(`Response: ${req.method} ${req.url} - Status: ${res.statusCode}, Headers: ${JSON.stringify(res.getHeaders())}`);
    });
    next();
});

// Explicit OPTIONS handling for /api/users
app.options('/api/users/*', cors(corsOptions), (req, res) => {
    res.status(200).end();
});

// Test CORS endpoint
app.get('/test-cors', cors(corsOptions), (req, res) => {
    res.json({
        message: 'CORS test endpoint',
        headers: {
            'Access-Control-Allow-Origin': res.get('Access-Control-Allow-Origin'),
            'Access-Control-Allow-Methods': res.get('Access-Control-Allow-Methods'),
            'Access-Control-Allow-Headers': res.get('Access-Control-Allow-Headers')
        }
    });
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/blogs', require('./routes/blogs'));

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('MongoDB connected successfully');
}).catch(err => {
    console.error('MongoDB connection error:', err);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});