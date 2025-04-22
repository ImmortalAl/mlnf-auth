const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const app = express();

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://<your_mongo_connection_string>', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    seed: { type: String, required: true },
    avatar: { type: String },
    status: { type: String },
    online: { type: Boolean, default: false },
});
const User = mongoose.model('User', UserSchema);

const MessageSchema = new mongoose.Schema({
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
});
const Message = mongoose.model('Message', MessageSchema);

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token' });
        req.user = user;
        next();
    });
}

app.post('/api/auth/register', async (req, res) => {
    const { username, password, seed, avatar, status } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = new User({ username, password: hashedPassword, seed, avatar, status });
        await user.save();
        const token = jwt.sign({ id: user._id, username }, JWT_SECRET, { expiresIn: '1h' });
        res.status(201).json({ token });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        await User.updateOne({ _id: user._id }, { online: true });
        const token = jwt.sign({ id: user._id, username }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ token });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/users/me', authenticateToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password -seed');
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.patch('/api/users/me', authenticateToken, async (req, res) => {
    try {
        const updates = req.body;
        const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true }).select('-password -seed');
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/users/online', authenticateToken, async (req, res) => {
    try {
        const users = await User.find({ online: true, _id: { $ne: req.user.id } }).select('username avatar status');
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/messages/send', authenticateToken, async (req, res) => {
    const { recipientId, content } = req.body;
    try {
        const recipient = await User.findById(recipientId);
        if (!recipient) return res.status(404).json({ error: 'Recipient not found' });
        const message = new Message({
            sender: req.user.id,
            recipient: recipientId,
            content,
        });
        await message.save();
        res.status(201).json({ message: 'Message sent' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/messages/history/:recipientId', authenticateToken, async (req, res) => {
    const { recipientId } = req.params;
    try {
        const messages = await Message.find({
            $or: [
                { sender: req.user.id, recipient: recipientId },
                { sender: recipientId, recipient: req.user.id },
            ],
        })
            .populate('sender', 'username avatar')
            .populate('recipient', 'username avatar')
            .sort({ timestamp: 1 });
        res.json(messages);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));