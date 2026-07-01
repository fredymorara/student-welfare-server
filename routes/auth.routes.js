const express = require('express');
const authController = require('../controllers/auth.controller');
const { validate, authSchemas } = require('../middleware/validation.middleware');
const router = express.Router();

router.post('/register', authSchemas.register, validate, authController.register);
router.post('/login', authSchemas.login, validate, authController.login);

router.get('/verify-email/:token', (req, res, next) => {
    const token = req.params.token;
    if (!token || token.length !== 40) {
        return res.status(400).json({ success: false, message: 'Invalid token format' });
    }
    next();
}, authController.verifyEmail);

router.post('/resend-verification-email', authController.resendVerificationEmail);
router.get('/validate-token', authController.validateToken);

module.exports = router;