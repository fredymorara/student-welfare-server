const authService = require('../services/auth.service');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');

exports.register = catchAsync(async (req, res) => {
    const user = await authService.registerUser(req.body);
    res.status(201).json({
        success: true,
        message: 'Registration successful! Please check your email to verify your account.',
        user
    });
});

exports.login = catchAsync(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        throw new ApiError(400, 'Please provide email and password');
    }

    const { user, token } = await authService.loginUser(email, password);
    res.status(200).json({
        success: true,
        message: 'Login successful',
        user,
        token
    });
});

exports.verifyEmail = catchAsync(async (req, res) => {
    const { token } = req.params;
    await authService.verifyEmail(token);
    res.status(200).json({
        success: true,
        message: 'Verification successful'
    });
});

exports.resendVerificationEmail = catchAsync(async (req, res) => {
    const { email } = req.body;
    if (!email) {
        throw new ApiError(400, 'Email is required to resend verification.');
    }

    await authService.resendVerificationEmail(email);
    res.status(200).json({
        success: true,
        message: 'Verification email resent successfully. Please check your inbox.'
    });
});

exports.validateToken = catchAsync(async (req, res) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
        throw new ApiError(401, 'No token provided');
    }

    authService.validateToken(token);
    res.status(200).json({ success: true, valid: true });
});