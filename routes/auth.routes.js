// routes/auth.routes.js
const express = require('express');
const authController = require('../controllers/auth.controller');

const router = express.Router();

// Register route
router.post('/register', authController.register);

// Login route
router.post('/login', authController.login);

module.exports = router;