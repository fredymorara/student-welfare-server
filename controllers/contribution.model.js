// models/contribution.model.js
const mongoose = require('mongoose');

const contributionSchema = new mongoose.Schema({
    amount: {
        type: Number,
        required: true,
        min: 1, // Minimum contribution amount is 1
    },
    contributionDate: {
        type: Date,
        default: Date.now,
    },
    transactionId: {
        type: String, // Transaction ID from M-Pesa or other payment gateway
    },
    paymentMethod: {
        type: String, // e.g., 'M-Pesa', 'Bank Transfer'
    },
    campaign: { // Reference to the Campaign to which the contribution is made
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Campaign',
        required: true,
    },
    contributor: { // Reference to the User who made the contribution
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
    updatedAt: {
        type: Date,
        default: Date.now,
    },
});

// Create the Contribution model from the schema
const Contribution = mongoose.model('Contribution', contributionSchema);

module.exports = Contribution; // Export the Contribution model