const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async function (req, res, next) {
    const authHeader = req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided or malformed header' });
    }
    const token = authHeader.replace('Bearer ', '');

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (!decoded.id) {
            return res.status(401).json({ error: 'Invalid token payload: ID missing' });
        }

        const user = await User.findById(decoded.id);

        if (!user) {
            console.warn(`[Auth Middleware] User not found in DB for ID: ${decoded.id}`);
            return res.status(401).json({ error: 'User linked to token not found' });
        }

        // Check if user is banned
        if (user.banned) {
            console.warn(`[Auth Middleware] Banned user attempted to access protected route: ${user.username}`);
            return res.status(403).json({ error: 'Your account has been banned from MLNF' });
        }
        
        req.user = user;

        next();
    } catch (error) {
        console.error('Auth middleware error:', error.message);
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        }
        if (error.name === 'TokenExpiredError') {
            // Attempt to set user offline when token expires
            try {
                const decoded = jwt.decode(token); // Decode without verification to get user ID
                if (decoded && decoded.id) {
                    await User.findByIdAndUpdate(decoded.id, { online: false });
                    console.log(`[Auth Middleware] Set user ${decoded.id} offline due to token expiry`);
                }
            } catch (offlineError) {
                console.warn(`[Auth Middleware] Could not set user offline on token expiry: ${offlineError.message}`);
            }
            return res.status(401).json({ error: 'Token expired' });
        }
        res.status(500).json({ error: 'Server error during authentication' });
    }
};