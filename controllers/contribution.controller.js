// controllers/contribution.controller.js
const Contribution = require('../models/contribution.model');
const Campaign = require('../models/campaign.model');
const User = require('../models/user.model');
const { validationResult } = require('express-validator');

exports.createContribution = async (req, res) => {
    const session = await Contribution.startSession();
    session.startTransaction();

    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { amount, campaignId, paymentMethod, transactionDetails } = req.body;

        // Verify campaign exists
        const campaign = await Campaign.findById(campaignId).session(session);
        if (!campaign) {
            return res.status(404).json({
                success: false,
                error: 'Campaign not found'
            });
        }

        // Verify user exists
        const user = await User.findById(req.user._id).session(session);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        // Create contribution
        const contribution = new Contribution({
            amount,
            campaign: campaignId,
            contributor: req.user._id,
            paymentMethod,
            ...transactionDetails
        });

        // Save contribution
        await contribution.save({ session });

        // Update campaign total
        campaign.currentAmount += amount;
        await campaign.save({ session });

        // Commit transaction
        await session.commitTransaction();

        // Populate contribution details
        const populatedContribution = await Contribution.findById(contribution._id)
            .populate('contributor', 'fullName email')
            .populate('campaign', 'title trackingNumber');

        res.status(201).json({
            success: true,
            data: populatedContribution
        });

    } catch (error) {
        await session.abortTransaction();
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        session.endSession();
    }
};

exports.getAllContributions = async (req, res) => {
    try {
        const { page = 1, limit = 10, status, paymentMethod } = req.query;
        const filter = {};

        if (status) filter.status = status;
        if (paymentMethod) filter.paymentMethod = paymentMethod;

        const contributions = await Contribution.find(filter)
            .populate('contributor', 'fullName email')
            .populate('campaign', 'title trackingNumber')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ paymentDate: -1 });

        const count = await Contribution.countDocuments(filter);

        res.json({
            success: true,
            data: contributions,
            meta: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(count / limit)
            }
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.getContributionById = async (req, res) => {
    try {
        const contribution = await Contribution.findById(req.params.id)
            .populate('contributor', 'fullName email')
            .populate('campaign', 'title trackingNumber');

        if (!contribution) {
            return res.status(404).json({
                success: false,
                error: 'Contribution not found'
            });
        }

        res.json({
            success: true,
            data: contribution
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.updateContributionStatus = async (req, res) => {
    try {
        const { status } = req.body;
        const allowedStatuses = ['pending', 'completed', 'failed', 'refunded'];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid status value'
            });
        }

        const contribution = await Contribution.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true, runValidators: true }
        ).populate('contributor campaign');

        if (!contribution) {
            return res.status(404).json({
                success: false,
                error: 'Contribution not found'
            });
        }

        res.json({
            success: true,
            data: contribution
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.getUserContributions = async (req, res) => {
    try {
        const contributions = await Contribution.find({ contributor: req.user._id })
            .populate('campaign', 'title category')
            .sort({ paymentDate: -1 });

        res.json({
            success: true,
            data: contributions
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.getCampaignContributions = async (req, res) => {
    try {
        const contributions = await Contribution.find({ campaign: req.params.campaignId })
            .populate('contributor', 'fullName admissionNumber')
            .sort({ paymentDate: -1 });

        res.json({
            success: true,
            data: contributions
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

exports.handlePaymentCallback = async (req, res) => {
    try {
        // Validate callback signature
        const isValidSignature = validateMpesaSignature(req.body);
        if (!isValidSignature) {
            return res.status(401).json({
                success: false,
                error: 'Invalid callback signature'
            });
        }

        const { transactionID, status, amount } = req.body;

        const contribution = await Contribution.findOneAndUpdate(
            { transactionId: transactionID },
            {
                status: status === 'success' ? 'completed' : 'failed',
                mpesaCode: req.body.mpesaReceiptNumber
            },
            { new: true }
        );

        if (!contribution) {
            return res.status(404).json({
                success: false,
                error: 'Contribution not found'
            });
        }

        // Update campaign total if successful
        if (status === 'success') {
            await Campaign.findByIdAndUpdate(
                contribution.campaign,
                { $inc: { currentAmount: amount } }
            );
        }

        res.json({
            success: true,
            data: contribution
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// Helper function for M-Pesa signature validation
function validateMpesaSignature(payload) {
    // Implementation depends on your payment provider
    return true; // Placeholder
}