// models/inquiry.model.js
const mongoose = require('mongoose');

const inquirySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
    },
    subject: {
        type: String,
        required: true,
        trim: true,
    },
    message: {
        type: String,
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

// Create the Inquiry model from the schema
const Inquiry = mongoose.model('Inquiry', inquirySchema);

module.exports = Inquiry; // Export the Inquiry model