// controllers/auth.controller.js
const User = require('../models/user.model');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

exports.register = async (req, res) => {
    try {
        // Normalize email to lowercase
        const email = req.body.email.toLowerCase();
        const { password, fullName, admissionNumber, role } = req.body;

        console.log('Registration request:', { email, fullName, admissionNumber, role });

        // Validate email domain
        if (!email.endsWith('@kabarak.ac.ke')) {
            return res.status(400).json({ message: 'Only @kabarak.ac.ke emails are allowed.' });
        }

        // Check for existing user (case-insensitive)
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ message: 'User already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user with normalized email
        const user = new User({
            email: email.toLowerCase(),
            password: hashedPassword,
            fullName,
            admissionNumber,
            role,
        });

        // Save user
        await user.save();

        // Create safe user object for response
        const userResponse = user.toObject();
        delete userResponse.password;

        // Generate token with role claim
        const token = jwt.sign(
            { _id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.status(201).json({
            message: 'User registered successfully',
            user: userResponse,
            token
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(400).json({
            message: 'Registration failed',
            error: error.message
        });
    }
};

exports.login = async (req, res) => {
    try {
        // Normalize email input
        const email = req.body.email.toLowerCase();
        const { password } = req.body;

        console.log('Login request:', { email });

        // Find user with case-insensitive search
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            console.log('User not found:', email);
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Verify password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.log('Password mismatch for:', email);
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Create safe user object
        const userResponse = user.toObject();
        delete userResponse.password;

        // Generate token with role
        const token = jwt.sign(
            { _id: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.json({
            message: 'Login successful',
            user: userResponse,
            token
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            message: 'Login failed',
            error: error.message
        });
    }
};