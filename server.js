// server.js
require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const connectDB = require('./config/db.config');
const authRoutes = require('./routes/auth.routes');
const rateLimit = require('express-rate-limit');
const contributionController = require('./controllers/contribution.controller'); // Import contribution controller
const logger = require('./utils/logger');

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
})

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Routes
app.use('/auth', authRoutes);
app.use('/member', require('./routes/member.routes'));
app.use('/admin', require('./routes/admin.routes'));
// Add this before your actual callback handler
app.use('/api/mpesa-callback', (req, res, next) => {
    console.log('RAW CALLBACK RECEIVED:', {
        method: req.method,
        headers: req.headers,
        body: req.body,
        query: req.query
    });
    next();
});

// M-Pesa callback route
app.post('/api/mpesa-callback', contributionController.handlePaymentCallback);
app.post('/api/b2c-timeout', contributionController.handleB2CTimeout);
app.post('/api/b2c-result', contributionController.handleB2CResult);

app.use((err, req, res, next) => {
    console.error("Unhandled Error:", err.stack);
    res.status(500).send('Something broke!');
})

app.get('/contributions/status/:transactionId', contributionController.getContributionStatus);
// Connect to MongoDB
connectDB();

// Start server
app.listen(port, () => {
    logger.info(`Server is running on port ${port}`);
    console.log(`Ensure M-Pesa callbacks point to: ${process.env.BASE_URL}`);
    console.log(`   B2C Result URL: ${process.env.MPESA_B2C_RESULT_URL}`);
    console.log(`   B2C Timeout URL: ${process.env.MPESA_B2C_TIMEOUT_URL}`);
    logger.info(`M-Pesa Callback URL: ${process.env.BASE_URL}/api/mpesa-callback`);
});