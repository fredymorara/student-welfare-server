// server.js
require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const connectDB = require('./config/db.config');
const authRoutes = require('./routes/auth.routes');
const rateLimit = require('express-rate-limit');
const contributionController = require('./controllers/contribution.controller'); // Import contribution controller

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

// M-Pesa callback route
app.post('/api/mpesa-callback', contributionController.handlePaymentCallback);
app.get('/contributions/status/:transactionId', contributionController.getContributionStatus);
// Connect to MongoDB
connectDB();

// Start server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});