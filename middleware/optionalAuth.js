const jwt = require('jsonwebtoken');
const User = require('../models/User');

// This middleware is for routes that can be accessed by both guests and authenticated users.
// If a valid token is provided, it attaches the user object to the request.
// If no token is provided, or if the token is invalid, it simply proceeds without a user object.
const optionalAuth = async (req, res, next) => {
    try {
        // Get token from header
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            // No token provided, continue without user
            req.user = null;
            return next();
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mlnf_secret_key');
        
        // Get user from token
        const user = await User.findById(decoded.id).select('-password');
        
        if (!user) {
            // Token is valid but user doesn't exist, continue without user
            req.user = null;
            return next();
        }

        // Check if user is banned
        if (user.banned) {
            req.user = null;
            return next();
        }

        // User found and valid
        req.user = user;
        next();

    } catch (error) {
        // Token is invalid, continue without user
        req.user = null;
        next();
    }
};

module.exports = optionalAuth; 