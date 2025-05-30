// back/middleware/adminAuth.js
const User = require('../models/User'); // Assuming your User model is here

module.exports = async function(req, res, next) {
    // req.user should be populated by your existing 'auth' middleware
    if (!req.user || !req.user.id) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        const user = await User.findById(req.user.id).select('role'); // Fetch only the role

        if (!user) {
            return res.status(401).json({ error: 'User not found for authentication' });
        }

        if (user.role !== 'admin') {
            // Log the attempt for security auditing if desired
            console.warn(`[ADMIN_ACCESS_DENIED] User ID: ${req.user.id} (Role: ${user.role || 'N/A'}) tried to access admin route: ${req.originalUrl}`);
            return res.status(403).json({ error: 'Forbidden: Administrator access required' });
        }

        // If user is admin, proceed to the next middleware or route handler
        next();
    } catch (error) {
        console.error('[ADMIN_AUTH_ERROR]', error);
        res.status(500).json({ error: 'Server error during admin authorization' });
    }
}; 