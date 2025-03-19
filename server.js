// server.js
require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const connectDB = require('./config/db.config');
const authRoutes = require('./routes/auth.routes');

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Routes
app.use('/auth', authRoutes);
app.use('/member', require('./routes/member.routes'));
app.use('/admin', require('./routes/admin.routes'));

// Connect to MongoDB
connectDB();

// Start server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});