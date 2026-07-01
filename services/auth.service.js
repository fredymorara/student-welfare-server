const User = require('../models/user.model');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const emailService = require('./email.service');
const ApiError = require('../utils/ApiError');

const registerUser = async (userData) => {
    const email = userData.email.toLowerCase();
    const { password, fullName, admissionNumber, role } = userData;

    if (!email.endsWith('@kabarak.ac.ke')) {
        throw new ApiError(400, 'Only @kabarak.ac.ke emails are allowed.');
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
        throw new ApiError(400, 'User already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(20).toString('hex').replace(/[^a-f0-9]/g, '');

    const user = new User({
        email,
        password: hashedPassword,
        fullName,
        admissionNumber,
        role,
        verificationToken,
        isVerified: false,
    });

    await user.save();

    // Send email asynchronously without blocking the user response
    emailService.sendVerificationEmail(email, verificationToken).catch(err => {
        console.error('Failed to send verification email silently:', err.message);
    });

    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.verificationToken;

    return userResponse;
};

const loginUser = async (email, password) => {
    const normalizedEmail = email.toLowerCase();
    
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
        throw new ApiError(400, 'Invalid credentials');
    }

    if (!user.isVerified) {
        throw new ApiError(401, 'Please verify your email address before logging in.');
    }

    if (!user.isActive) {
        throw new ApiError(401, 'Your account is inactive. Please contact the administrator.');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        throw new ApiError(400, 'Invalid credentials');
    }

    const token = jwt.sign(
        { _id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
    );

    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.verificationToken;

    return { user: userResponse, token };
};

const verifyEmail = async (token) => {
    const user = await User.findOne({ verificationToken: token }).select('+verificationToken');
    if (!user) {
        throw new ApiError(400, 'Invalid or expired token');
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save();
    
    return true;
};

const resendVerificationEmail = async (email) => {
    const normalizedEmail = email.toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    
    if (!user) {
        throw new ApiError(404, 'User with this email not found.');
    }

    if (user.isVerified) {
        throw new ApiError(400, 'This account is already verified.');
    }

    const verificationToken = crypto.randomBytes(20).toString('hex').replace(/[^a-f0-9]/g, '');
    user.verificationToken = verificationToken;
    await user.save();

    await emailService.sendVerificationEmail(normalizedEmail, verificationToken);
    return true;
};

const validateToken = (token) => {
    try {
        jwt.verify(token, process.env.JWT_SECRET);
        return true;
    } catch (error) {
        throw new ApiError(401, 'Invalid token');
    }
};

module.exports = {
    registerUser,
    loginUser,
    verifyEmail,
    resendVerificationEmail,
    validateToken
};
