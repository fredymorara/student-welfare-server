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
        enum: ['Medical', 'Academic', 'Emergency', 'Other', 'Environmental', 'Sports', 'Education', 'Social Welfare'],
        default: 'Other',
        required: true, // Corrected 'true' to true
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
        // UPDATED ENUM to include disbursement lifecycle
        enum: [
            'pending_approval', // Member applied
            'active',           // Admin approved, collecting funds
            'rejected',         // Admin rejected
            'ended',            // Collection period finished (manually or by date/goal)
            'disbursing',       // B2C initiated, waiting for callback
            'disbursed',        // B2C successful callback received
            'disbursement_failed' // B2C failed callback or timeout received
        ],
        default: 'pending_approval',
        index: true, // Added index for status
    },
    trackingNumber: {
        type: String,
        unique: true, // Tracking number should be unique
    },
    beneficiary: { // Link to the beneficiary (assuming User model will be created later)
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Reference to the User model (will be created later)
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true, // Added index
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
    disbursementDetails: { // Admin entered remarks/details
        type: String,
        trim: true,
    },
    disbursementAmount: { // Amount actually disbursed (or attempted)
        type: Number,
        min: 0,
    },
    disbursementDate: { // Date disbursement was initiated by admin
        type: Date,
    },
    disbursementMethod: { // Method used (should be M-Pesa B2C here)
        type: String,
        enum: ['M-Pesa B2C', 'Bank Transfer', 'Cash', 'Other'], // Added M-Pesa B2C
    },
    disbursementRecipientPhone: { // Target phone number for B2C
        type: String,
        trim: true,
    },
    disbursementRecipientName: { // Optional: Name of recipient
        type: String,
        trim: true,
    },
    disbursementInitiatedBy: { // Admin who initiated
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    disbursementTransactionID: { // M-Pesa ConversationID for B2C request
        type: String,
        index: true, // Index for looking up during callback
    },
    disbursementMpesaReceipt: { // Actual M-Pesa B2C transaction receipt from callback
        type: String,
    },
    disbursementStatus: { // Tracks the B2C transaction progress specifically
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed', 'timeout'],
        // default: 'pending', // Set explicitly during initiation
    },
    disbursementResultCode: { // Result code from M-Pesa callback
        type: String,
    },
    disbursementResultDesc: { // Result description from M-Pesa callback
        type: String,
    },
}, { timestamps: true });

campaignSchema.index({ beneficiary: 1 });

const Campaign = mongoose.model('Campaign', campaignSchema);

module.exports = Campaign; // Export the Campaign model