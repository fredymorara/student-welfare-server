// routes/auth.routes.js
const express = require('express');
const authController = require('../controllers/auth.controller');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Register route
router.post('/register', authController.register);

// Login route
router.post('/login', authController.login);

// Email verification route
router.get('/verify-email/:token', (req, res, next) => {
    const token = req.params.token;
    if (!token || token.length !== 40) {
        return res.status(400).json({ message: 'Invalid token format' });
    }
    next();
}, authController.verifyEmail); // New route for email verification

// Resend verification email route
router.post('/resend-verification-email', authController.resendVerificationEmail);


router.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
});

router.get('/validate-token', authController.validateToken);

module.exports = router;