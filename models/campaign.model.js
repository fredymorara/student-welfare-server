// models/campaign.model.js
const mongoose = require('mongoose');
// REMOVE: const crypto = require('crypto'); // No longer needed here

const campaignSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
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
        required: true,
    },
    goalAmount: {
        type: Number,
        required: true,
        min: 0,
    },
    currentAmount: {
        type: Number,
        default: 0,
    },
    startDate: {
        type: Date,
        default: Date.now,
    },
    endDate: {
        type: Date,
        required: true,
    },
    status: {
        type: String,
        enum: [
            'pending_approval',
            'active',
            'rejected',
            'ended',
            'disbursing',
            'disbursed',
            'disbursement_failed'
        ],
        default: 'pending_approval',
        index: true,
    },
    // REMOVE THE trackingNumber FIELD DEFINITION ENTIRELY
    // trackingNumber: {
    //     type: String,
    //     unique: true,
    //     trim: true,
    //     index: true,
    // },
    beneficiary: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true,
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    },
    rejectionReason: {
        type: String,
    },
    // ... rest of the fields (disbursement etc.) remain the same ...
    disbursementDetails: { type: String, trim: true },
    disbursementAmount: { type: Number, min: 0 },
    disbursementDate: { type: Date },
    disbursementMethod: { type: String, enum: ['M-Pesa B2C', 'Bank Transfer', 'Cash', 'Other'] },
    disbursementRecipientPhone: { type: String, trim: true },
    disbursementRecipientName: { type: String, trim: true },
    disbursementInitiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    disbursementTransactionID: { type: String, index: true },
    disbursementMpesaReceipt: { type: String },
    disbursementStatus: { type: String, enum: ['pending', 'processing', 'completed', 'failed', 'timeout'] },
    disbursementResultCode: { type: String },
    disbursementResultDesc: { type: String },
}, { timestamps: true });

// REMOVE THE PRE-SAVE HOOK ENTIRELY
// campaignSchema.pre('save', function(next) { ... });

campaignSchema.index({ beneficiary: 1 });

const Campaign = mongoose.model('Campaign', campaignSchema);

module.exports = Campaign;