// models/campaign.model.js
const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true, // Removes whitespace from both ends of a string
    },
    description: {
        type: String,
        required: true,
    },
    details: {
        type: String,
    },
    category: {
        type: String,
        enum: ['Medical', 'Academic', 'Emergency', 'Other'], // Restrict to specific categories
        default: 'Other',
        required: 'true',
    },
    goalAmount: {
        type: Number,
        required: true,
        min: 0, // Goal amount cannot be negative
    },
    currentAmount: {
        type: Number,
        default: 0, // Initially raised amount is 0
    },
    startDate: {
        type: Date,
        default: Date.now, // Default to current date
    },
    endDate: {
        type: Date,
        required: true, // End date is required
    },
    // Add enum validation for status field
    status: {
        type: String,
        enum: ['pending_approval', 'active', 'ended', 'rejected'], // Remove 'approved'
        default: 'pending_approval',
    },
    trackingNumber: {
        type: String,
        unique: true, // Tracking number should be unique
    },
    beneficiary: { // Link to the beneficiary (assuming User model will be created later)
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Reference to the User model (will be created later)
    },
    createdBy: { // Track who created the campaign (Admin or Secretary - if you re-introduce Secretary role later)
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Reference to the User model
    },
    approvedBy: { // Track who approved the campaign (Admin)
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Reference to the User model
    },
    rejectionReason: {
        type: String, // Reason for rejection, if campaign is rejected
    },
    createdAt: {
        type: Date,
        default: Date.now, // Timestamp when the campaign was created
    },
    updatedAt: {
        type: Date,
        default: Date.now, // Timestamp when the campaign was last updated
    },
    disbursementDate: {
        type: Date, // Date when funds were disbursed
    },
    disbursementMethod: {
        type: String, // e.g., 'M-Pesa', 'Bank Transfer', 'Cash'
        enum: ['M-Pesa', 'Bank Transfer', 'Cash', 'Other'], // Allowed disbursement methods
    },
    disbursementDetails: {
        type: String, // Additional details about the disbursement (e.g., M-Pesa transaction ID, bank details)
    },
    disbursementInitiatedBy: { // Track who initiated the disbursement (Admin)
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Reference to the User model (Admin user)
    },
    disbursementApprovedBy: { // Optionally, track who approved the disbursement (Admin - if you want a separate approval step)
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Reference to the User model (Admin user)
    },
    disbursementStatus: {
        type: String, // e.g., 'pending', 'processing', 'completed', 'failed'
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'pending', // Initial status is pending
    },
    disbursementAmount: {
        type: Number, // Amount disbursed (can be less than or equal to currentAmount)
    },
}, { timestamps: true });

campaignSchema.index({ status: 1 });
campaignSchema.index({ createdBy: 1 });
campaignSchema.index({ beneficiary: 1 });
// Create the Campaign model from the schema
const Campaign = mongoose.model('Campaign', campaignSchema);

module.exports = Campaign; // Export the Campaign model