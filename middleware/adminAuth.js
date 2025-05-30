// back/middleware/adminAuth.js
const User = require('../models/User'); // Assuming your User model is here

module.exports = async function(req, res, next) {
    console.log('[AdminAuth Middleware] req.user received:', JSON.stringify(req.user)); // Log incoming req.user

    // req.user should be populated by your existing 'auth' middleware
    if (!req.user || !req.user.id) {
        console.warn('[AdminAuth Middleware] Denying access: Authentication required (req.user or req.user.id missing).');
        return res.status(401).json({ error: 'Authentication required' });
    }

    try {
        console.log(`[AdminAuth Middleware] Fetching user from DB with ID: ${req.user.id}`);
        const user = await User.findById(req.user.id).select('role username'); // Select username for logging

        if (!user) {
            console.warn(`[AdminAuth Middleware] Denying access: User not found in DB for ID: ${req.user.id}. req.user was:`, JSON.stringify(req.user));
            return res.status(401).json({ error: 'User not found for authentication' });
        }

        console.log(`[AdminAuth Middleware] User fetched from DB: username: ${user.username}, role: ${user.role}`); // Log fetched user and role

        if (user.role !== 'admin') {
            console.warn(`[AdminAuth Middleware] Denying access: User ${user.username} (ID: ${req.user.id}) has role "${user.role}", not "admin".`);
            return res.status(403).json({ error: 'Forbidden: Administrator access required' });
        }

        console.log(`[AdminAuth Middleware] Access GRANTED for admin user: ${user.username} (ID: ${req.user.id})`);
        next();
    } catch (error) {
        console.error('[ADMIN_AUTH_ERROR] Error in adminAuth middleware:', error);
        res.status(500).json({ error: 'Server error during admin authorization' });
    }
}; 