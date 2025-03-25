// controllers/auth.controller.js
const User = require('../models/user.model');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer'); // Import nodemailer
const crypto = require('crypto'); // Import crypto for token generation

// Nodemailer transporter setup (configure your email service)
const transporter = nodemailer.createTransport({
    service: 'Gmail', // Or your email service
    auth: {
        user: process.env.EMAIL_USER, // Your email address
        pass: process.env.EMAIL_PASS, // Your email password or app password
    },
});

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

        // Generate verification token
        const verificationToken = crypto.randomBytes(20)
            .toString('hex')
            .replace(/[^a-f0-9]/g, '');
        console.log('Generated Token:', verificationToken);

        // Create user with normalized email and verification token
        const user = new User({
            email: email.toLowerCase(),
            password: hashedPassword,
            fullName,
            admissionNumber,
            role,
            verificationToken: verificationToken, // Store verification token
            isVerified: false, // Initially not verified
        });

        // Save user
        await user.save();
        console.log('Stored Token:', user.verificationToken);

        // Send verification email
        // In registration handler
        const verificationUrl = `${process.env.FRONTEND_URL}/auth/verify-email/${verificationToken}`;
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Verify Your Email Address - KABU Welfare System',
            html: `<p>Please verify your email address by clicking on the following link: <a href="${verificationUrl}">${verificationUrl}</a></p>`,
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Email sending error:', error);
                // Optionally handle email sending failure more gracefully (e.g., log error, but still return success to user)
            } else {
                console.log('Verification email sent:', info.response);
            }
        });


        // Create safe user object for response (exclude sensitive data)
        const userResponse = user.toObject();
        delete userResponse.password;
        delete userResponse.verificationToken; // Don't send verification token to frontend

        res.status(201).json({
            message: 'Registration successful! Please check your email to verify your account.', // Updated message
            user: userResponse,
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

        console.log("User found during login:", user); // ADD LOG - Log user object found for login

        // Check if user is verified
        if (!user.isVerified) {
            console.log("User is not verified:", email); // ADD LOG
            return res.status(401).json({ message: 'Please verify your email address before logging in.' }); // New check
        }


        // Check if user is active
        if (!user.isActive) {
            console.log('Inactive user login attempt:', email);
            return res.status(401).json({ message: 'Your account is inactive. Please contact the administrator.' });
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
        delete userResponse.verificationToken; // Don't send verification token to frontend

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

exports.verifyEmail = async (req, res) => {
    const { token } = req.params;
    try {
        const user = await User.findOne({ verificationToken: token }).select('+verificationToken');

        if (!user) {
            console.log(`Token Search: ${token}`);
            const allTokens = await User.find({}).select('verificationToken');
            console.log('Existing Tokens:', allTokens);
            return res.status(400).json({ message: 'Invalid token' });
        }

        // Debug output
        console.log('Found User:', {
            _id: user._id,
            storedToken: user.verificationToken,
            inputToken: token,
            match: user.verificationToken === token
        });

        user.isVerified = true;
        user.verificationToken = undefined;
        await user.save();

        res.json({ message: 'Verification successful' });
    } catch (error) {
        console.error('Verification Error:', error);
        res.status(500).json({ message: 'Verification failed' });
    }
};

exports.resendVerificationEmail = async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'Email is required to resend verification.' });
    }

    try {
        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(404).json({ message: 'User with this email not found.' });
        }

        if (user.isVerified) {
            return res.status(400).json({ message: 'This account is already verified.' });
        }

        // Generate a new verification token
        const verificationToken = crypto.randomBytes(20)
            .toString('hex')
            .replace(/[^a-f0-9]/g, '');
        user.verificationToken = verificationToken;
        await user.save();

        // Send verification email (re-use your email sending logic from register)
        const verificationUrl = `${process.env.FRONTEND_URL}/auth/verify-email/${verificationToken}`;
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Verify Your Email Address - KABU Welfare System',
            html: `<p>Please verify your email address by clicking on the following link: <a href="${verificationUrl}">${verificationUrl}</a></p>`,
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Email resending error:', error);
                return res.status(500).json({ message: 'Failed to resend verification email due to server error.' });
            } else {
                console.log('Verification email resent:', info.response);
                return res.json({ message: 'Verification email resent successfully. Please check your inbox.' });
            }
        });


    } catch (error) {
        console.error('Resend verification email error:', error);
        res.status(500).json({ message: 'Failed to resend verification email.', error: error.message });
    }
};