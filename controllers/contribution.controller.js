// controllers/contribution.controller.js
const Contribution = require('../models/contribution.model');
const Campaign = require('../models/campaign.model');
const User = require('../models/user.model');
const { validationResult } = require('express-validator');
const crypto = require('crypto')
const mongoose = require('mongoose');

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


function validateMpesaSignature(body, signature) {
    const publicKey = process.env.MPESA_PUBLIC_KEY;
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(JSON.stringify(body));
    return verifier.verify(publicKey, signature, 'base64');
}

exports.handlePaymentCallback = async (req, res) => {
    try {
        console.log("M-Pesa Callback:", req.body);

        // Handle nested callback structure
        const callback = req.body.Body?.stkCallback || req.body;
        if (!callback) {
            return res.status(400).json({ error: 'Invalid callback format' });
        }

        const checkoutRequestId = callback.CheckoutRequestID;
        const resultCode = callback.ResultCode.toString(); // Ensure string comparison

        // Find contribution using transactionId
        const contribution = await Contribution.findOne({
            transactionId: checkoutRequestId
        }).populate('campaign');

        if (!contribution) {
            console.error("Contribution not found:", checkoutRequestId);
            return res.status(404).json({ error: 'Contribution not found' });
        }

        if (resultCode === '0') {
            // Extract M-Pesa receipt
            const receipt = callback.CallbackMetadata?.Item?.find(
                i => i.Name === 'MpesaReceiptNumber'
            )?.Value;

            // Update contribution
            contribution.status = 'completed';
            contribution.mpesaCode = receipt || 'N/A';
            await contribution.save();

            // Update campaign
            await Campaign.findByIdAndUpdate(
                contribution.campaign._id,
                { $inc: { currentAmount: contribution.amount } },
                { new: true }
            );
        } else {
            contribution.status = 'failed';
            await contribution.save();
        }

        res.status(200).send();
    } catch (error) {
        console.error('Callback error:', error);
        res.status(500).json({ error: error.message });
    }
};

exports.getContributionStatus = async (req, res) => {
    const { transactionId } = req.params;
    try {
        const contribution = await Contribution.findOne({ transactionId });
        if (!contribution) {
            return res.status(404).json({ message: 'Contribution not found' });
        }
        res.json({ status: contribution.status }); // Respond with just the status
    } catch (error) {
        console.error('Error fetching contribution status:', error);
        res.status(500).json({ message: 'Error fetching contribution status', error: error.message });
    }
};

exports.handleB2CResult = async (req, res) => {
    console.log("--- B2C Result Callback Received ---");
    console.log("Headers:", JSON.stringify(req.headers)); // Log headers (useful for debugging)
    console.log("Body:", JSON.stringify(req.body));

    // TODO: IMPLEMENT SIGNATURE VALIDATION HERE FOR PRODUCTION

    const callbackData = req.body.Result;

    if (!callbackData) {
        console.error("Invalid B2C Result callback format: Missing 'Result' object.");
        // Respond 200 OK to M-Pesa even on error to prevent retries
        return res.status(200).json({ ResultCode: 1, ResultDesc: "Invalid format received" });
    }

    const conversationID = callbackData.ConversationID;
    const originatorConversationID = callbackData.OriginatorConversationID; // Use if you sent one
    const resultCode = callbackData.ResultCode.toString(); // Ensure string comparison
    const resultDesc = callbackData.ResultDesc;
    const transactionID = callbackData.TransactionID; // M-Pesa's receipt number

    // Extract details from ResultParameters if needed (e.g., final amount, recipient)
    let transactionAmount = null;
    let mpesaReceiptNumber = null;
    let recipientRegistered = null;

    if (callbackData.ResultParameters && callbackData.ResultParameters.ResultParameter) {
        const params = callbackData.ResultParameters.ResultParameter;
        transactionAmount = params.find(p => p.Key === 'TransactionAmount')?.Value;
        mpesaReceiptNumber = params.find(p => p.Key === 'TransactionReceipt')?.Value || transactionID; // Fallback to TransactionID
        recipientRegistered = params.find(p => p.Key === 'RegisteredCustomerName')?.Value; // Useful info
    }

    console.log(`Processing B2C Result: ConvID=${conversationID}, Result=${resultCode}, Desc=${resultDesc}, MpesaReceipt=${mpesaReceiptNumber}`);


    if (!conversationID) {
        console.error("B2C Result callback missing ConversationID.");
        return res.status(200).json({ ResultCode: 1, ResultDesc: "Missing ConversationID" });
    }

    // Use a try-catch for database operations
    try {
        // Find the campaign using the ConversationID stored during initiation
        const campaign = await Campaign.findOne({ disbursementTransactionID: conversationID });

        if (!campaign) {
            console.error(`Campaign not found for ConversationID: ${conversationID}`);
            // Still respond 200 OK to M-Pesa
            return res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted - Campaign not found locally" });
        }

        // Avoid processing callbacks multiple times for the same transaction
        if (campaign.disbursementStatus === 'completed' || campaign.disbursementStatus === 'failed') {
            console.warn(`Received duplicate B2C callback for already processed campaign ${campaign._id} (ConvID: ${conversationID}). Current Status: ${campaign.disbursementStatus}`);
            return res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted - Duplicate callback ignored" });
        }


        if (resultCode === '0') {
            // SUCCESSFUL B2C Transaction
            console.log(`B2C Success for Campaign ${campaign._id}.`);
            campaign.status = 'disbursed'; // Update main status
            campaign.disbursementStatus = 'completed';
            campaign.disbursementResultCode = resultCode;
            campaign.disbursementResultDesc = resultDesc;
            campaign.disbursementMpesaReceipt = mpesaReceiptNumber || transactionID; // Store the M-Pesa receipt

            // Optional: Adjust currentAmount if you didn't deduct during initiation
            // campaign.currentAmount -= campaign.disbursementAmount; // Deduct only on success

        } else {
            // FAILED B2C Transaction
            console.error(`B2C Failure for Campaign ${campaign._id}. ResultCode: ${resultCode}, Desc: ${resultDesc}`);
            campaign.status = 'disbursement_failed'; // Update main status
            campaign.disbursementStatus = 'failed';
            campaign.disbursementResultCode = resultCode;
            campaign.disbursementResultDesc = resultDesc;
            // Do not store MpesaReceipt on failure
        }

        await campaign.save();
        console.log(`Campaign ${campaign._id} updated successfully based on B2C callback.`);

        // Respond 200 OK to M-Pesa to acknowledge receipt
        res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });

    } catch (dbError) {
        console.error(`Database error processing B2C Result callback for ConvID ${conversationID}:`, dbError);
        // If DB fails, M-Pesa might retry. Respond with an error code (e.g., 1) might stop retries,
        // but check Safaricom docs. Safest is usually 200 OK and handle internally.
        res.status(200).json({ ResultCode: 1, ResultDesc: "Internal server error during processing" });
    }
};

// --- NEW: B2C Timeout Callback Handler ---
exports.handleB2CTimeout = async (req, res) => {
    console.log("--- B2C Timeout Callback Received ---");
    console.log("Headers:", JSON.stringify(req.headers));
    console.log("Body:", JSON.stringify(req.body));

    // Timeout payload is simpler, often just contains the ConversationID
    // Check Safaricom docs for exact structure if needed, but usually it's minimal.
    // Example: Might be inside a 'Result' object similar to success/fail, or directly in body. Adjust accordingly.

    const callbackData = req.body.Result || req.body; // Adjust based on actual payload observed
    const conversationID = callbackData.ConversationID || callbackData.OriginatorConversationID; // Try both

    console.log(`Processing B2C Timeout: ConvID=${conversationID}`);

    if (!conversationID) {
        console.error("B2C Timeout callback missing ConversationID.");
        return res.status(200).json({ ResultCode: 1, ResultDesc: "Missing ConversationID in timeout" });
    }

    // Use a try-catch for database operations
    try {
        // Find the campaign using the ConversationID
        const campaign = await Campaign.findOne({ disbursementTransactionID: conversationID });

        if (!campaign) {
            console.error(`Campaign not found for Timeout ConversationID: ${conversationID}`);
            return res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted - Campaign not found locally (timeout)" });
        }

        // Only update if it's still 'processing' - avoid overwriting a success/fail that arrived earlier
        if (campaign.disbursementStatus === 'processing') {
            console.warn(`B2C Timeout received for Campaign ${campaign._id}. Setting status to failed.`);
            campaign.status = 'disbursement_failed'; // Update main status
            campaign.disbursementStatus = 'timeout'; // Specific timeout status
            campaign.disbursementResultDesc = 'Transaction timed out waiting for response from M-Pesa.';

            await campaign.save();
            console.log(`Campaign ${campaign._id} updated to 'timeout' status.`);

        } else {
            console.warn(`Received Timeout callback for campaign ${campaign._id} (ConvID: ${conversationID}), but status is already '${campaign.disbursementStatus}'. Ignoring timeout.`);
        }

        // Respond 200 OK to M-Pesa
        res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted (Timeout)" });

    } catch (dbError) {
        console.error(`Database error processing B2C Timeout callback for ConvID ${conversationID}:`, dbError);
        res.status(200).json({ ResultCode: 1, ResultDesc: "Internal server error during timeout processing" });
    }
};