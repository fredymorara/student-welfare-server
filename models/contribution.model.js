// models/contribution.model.js
const mongoose = require('mongoose');

const contributionSchema = new mongoose.Schema({
    amount: {
        type: Number,
        required: true,
        min: 1 // Minimum contribution amount is 1 KES
    },
    contributor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    campaign: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Campaign',
        required: true
    },
    transactionId: {
        type: String,
        unique: true,
        required: true
    },
    paymentMethod: {
        type: String,
        enum: ['M-Pesa', 'Card', 'Bank Transfer', 'Cash'],
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'refunded'],
        default: 'pending'
    },
    paymentDate: {
        type: Date,
        default: Date.now
    },
    mpesaCode: { // For M-Pesa transactions
        type: String,
        sparse: true,
        default: null,
    },
    bankReference: { // For bank transfers
        type: String,
        sparse: true
    },
    cardLast4: { // For card payments
        type: String,
        sparse: true
    }
}, {
    timestamps: true, // Adds createdAt and updatedAt automatically
    autoIndex: false
});

// Indexes for faster querying
contributionSchema.index({ contributor: 1 });
contributionSchema.index({ campaign: 1 });
contributionSchema.index({ transactionId: 1 }, { unique: true });

// Virtual property for formatted amount
contributionSchema.virtual('formattedAmount').get(function () {
    return `KES ${this.amount.toLocaleString()}`;
});

const Contribution = mongoose.model('Contribution', contributionSchema);

module.exports = Contribution;