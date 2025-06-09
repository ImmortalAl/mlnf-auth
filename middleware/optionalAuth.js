const jwt = require('jsonwebtoken');
const User = require('../models/User');

// This middleware is for routes that can be accessed by both guests and authenticated users.
// If a valid token is provided, it attaches the user object to the request.
// If no token is provided, or if the token is invalid, it simply proceeds without a user object.
module.exports = async function (req, res, next) {
    const authHeader = req.header('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // No token, proceed as a guest
        return next();
    }
    
    const token = authHeader.replace('Bearer ', '');

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (decoded.id) {
            const user = await User.findById(decoded.id).select('-password');
            if (user) {
                // Attach user to the request
                req.user = user;
            }
        }
    } catch (error) {
        // Invalid token (expired, malformed, etc.), but that's okay.
        // We'll just treat them as a guest.
        // We log it for debugging but don't send an error response.
        console.log(`[Optional Auth] Invalid token encountered: ${error.message}`);
    }

    next();
}; 