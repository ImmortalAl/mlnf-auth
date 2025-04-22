const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const rateLimit = require('express-rate-limit');
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

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// Rate limiting
app.use(rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per IP
    message: 'Too many requests from this IP, please try again later.'
}));

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
    console.log('Uploads folder created at:', uploadsDir);
}

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Multer for file uploads
const upload = multer({ dest: uploadsDir });

// MongoDB connection with retry
const connectDB = async () => {
    let retries = 5;
    while (retries) {
        try {
            await mongoose.connect(process.env.MONGO_URI, {
                useNewUrlParser: true,
                useUnifiedTopology: true
            });
            console.log('MongoDB connected');
            break;
        } catch (err) {
            console.error('MongoDB connection error:', err);
            retries -= 1;
            if (retries === 0) {
                console.error('MongoDB connection failed after retries');
                process.exit(1);
            }
            console.log(`Retrying MongoDB connection (${retries} attempts left)...`);
            await new Promise(res => setTimeout(res, 5000)); // Wait 5s
        }
    }
};
connectDB();

// Routes
console.log('Mounting routes...');
app.use('/api/users', userRoutes);
console.log('Mounted /api/users');
app.use('/api/auth', authRoutes);
console.log('Mounted /api/auth');

// Cloudinary upload route
app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const result = await cloudinary.uploader.upload(req.file.path, {
            folder: 'mlnf_uploads',
            overwrite: false,
            invalidate: true
        });
        fs.unlinkSync(req.file.path); // Clean up local file
        res.json({ url: result.secure_url });
    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ error: 'Upload failed' });
    }
});

// Global error handling
app.use((err, req, res, next) => {
    console.error('Server error:', err.stack);
    res.status(500).json({ error: 'Internal server error' });
});

// Start server
const port = process.env.PORT || 3001;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});