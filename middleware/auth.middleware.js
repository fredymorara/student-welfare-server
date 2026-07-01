const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

const authMiddleware = (allowedRoles) => {
    return async (req, res, next) => {
        try {
            const token = req.header('Authorization')?.replace('Bearer ', '');
            if (!token) throw new Error('No token provided');

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findOne({ _id: decoded._id });

            if (!user) throw new Error('User not found');
            if (!user.isActive) throw new Error('Account has been revoked. Please contact administration.');
            if (user.validUntil && new Date() > new Date(user.validUntil)) {
                throw new Error('Account validity period has expired.');
            }

            // Add more descriptive error messages
            if (!allowedRoles.includes(user.role)) {
                throw new Error(`Role ${user.role} not authorized for this route`);
            }

            req.user = user;
            req.token = token;
            next();
        } catch (error) {
            res.status(401).json({ message: 'Authentication failed', error: error.message });
        }
    };
};

module.exports = authMiddleware;