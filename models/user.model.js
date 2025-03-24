// models/user.model.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    admissionNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    fullName: {
        type: String,
        required: true,
        trim: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    password: {
        type: String,
        required: true,
        minlength: 8,
        validate: {
            validator: function (v) {
                return /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*]).{8,}$/.test(v);
            },
            message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        },
    },
    role: {
        type: String,
        enum: ['member', 'admin'],
        default: 'member',
    },
    profilePicture: {
        type: String,
    },
    validUntil: {
        type: Date,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    isVerified: { // New field for email verification status
        type: Boolean,
        default: false,
    },
    // In user.model.js
    verificationToken: {
        type: String,
        index: {
            unique: true,
            partialFilterExpression: { verificationToken: { $type: 'string' } }
        }
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
    // Inside userSchema in user.model.js
    schoolFaculty: {
        type: String,
        trim: true,
    },
}, { timestamps: true });


const User = mongoose.model('User', userSchema);
module.exports = User;