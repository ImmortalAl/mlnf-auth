require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const userRoutes = require('./routes/users');
const authRoutes = require('./routes/auth');

const app = express();

// CORS configuration
const allowedOrigins = [
    'https://mlnf.net',
    'https://dashing-belekoy-7a0095.netlify.app',
    'https://immortalal.github.io',
    'http://localhost:3000',
    'http://localhost:8080',
    'http://127.0.0.1:3000'
];
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'Uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(UploadsDir);
    console.log('Uploads folder created at:', uploadsDir);
}

// MongoDB connection
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('MongoDB connected');
    } catch (err) {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    }
};
connectDB();

// Routes
console.log('Mounting routes...');
app.use('/api/users', userRoutes);
console.log('Mounted /api/users');
app.use('/api/auth', authRoutes);
console.log('Mounted /api/auth');

// Start server
const port = process.env.PORT || 3001;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});