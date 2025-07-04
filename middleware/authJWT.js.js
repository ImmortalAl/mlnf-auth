const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
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
        
        req.userId = decoded.id;
        req.username = decoded.username;
        req.roles = decoded.roles || [];
        
        next();
    } catch (error) {
        console.error('Auth middleware error:', error.message);
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' });
        }
        res.status(500).json({ error: 'Server error during authentication' });
    }
};

module.exports = {
    verifyToken
};