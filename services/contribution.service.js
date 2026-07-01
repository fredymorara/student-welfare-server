const Contribution = require('../models/contribution.model');
const Campaign = require('../models/campaign.model');
const User = require('../models/user.model');
const mongoose = require('mongoose');
const mpesaService = require('./mpesa.service');
const ApiError = require('../utils/ApiError');

const createContribution = async (contributionData, userId) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { amount, campaignId, paymentMethod, transactionDetails } = contributionData;

        const campaign = await Campaign.findById(campaignId).session(session);
        if (!campaign) throw new ApiError(404, 'Campaign not found');

        const user = await User.findById(userId).session(session);
        if (!user) throw new ApiError(404, 'User not found');

        const contribution = new Contribution({
            amount,
            campaign: campaignId,
            contributor: userId,
            paymentMethod,
            ...transactionDetails
        });

        await contribution.save({ session });
        campaign.currentAmount += amount;
        await campaign.save({ session });

        await session.commitTransaction();

        return await Contribution.findById(contribution._id)
            .populate('contributor', 'fullName email')
            .populate('campaign', 'title');

    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

const getAllContributions = async (page = 1, limit = 10, status, paymentMethod) => {
    const filter = {};
    if (status) filter.status = status;
    if (paymentMethod) filter.paymentMethod = paymentMethod;

    const contributions = await Contribution.find(filter)
        .populate('contributor', 'fullName email')
        .populate('campaign', 'title')
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ paymentDate: -1 });

    const count = await Contribution.countDocuments(filter);
    return { contributions, count, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(count / limit) };
};

const getContributionById = async (id) => {
    const contribution = await Contribution.findById(id)
        .populate('contributor', 'fullName email')
        .populate('campaign', 'title');
    if (!contribution) throw new ApiError(404, 'Contribution not found');
    return contribution;
};

const updateContributionStatus = async (id, status) => {
    const allowedStatuses = ['pending', 'completed', 'failed', 'refunded'];
    if (!allowedStatuses.includes(status)) throw new ApiError(400, 'Invalid status value');

    const contribution = await Contribution.findByIdAndUpdate(
        id,
        { status },
        { new: true, runValidators: true }
    ).populate('contributor campaign');
    
    if (!contribution) throw new ApiError(404, 'Contribution not found');
    return contribution;
};

const getUserContributions = async (userId) => {
    return await Contribution.find({ contributor: userId })
        .populate('campaign', 'title category')
        .sort({ paymentDate: -1 });
};

const getCampaignContributions = async (campaignId) => {
    return await Contribution.find({ campaign: campaignId })
        .populate('contributor', 'fullName admissionNumber')
        .sort({ paymentDate: -1 });
};

const processPaymentCallback = async (callbackData, callbackId) => {
    const session = await mongoose.startSession();
    try {
        session.startTransaction();
        const callback = callbackData.Body?.stkCallback || callbackData;
        if (!callback) throw new ApiError(400, 'Invalid callback format');

        const checkoutRequestId = callback.CheckoutRequestID;
        const resultCode = callback.ResultCode?.toString();

        const contribution = await Contribution.findOne({ transactionId: checkoutRequestId }).session(session).populate('campaign');
        if (!contribution) {
            await session.abortTransaction();
            throw new ApiError(404, 'Contribution not found');
        }

        if (['completed', 'failed'].includes(contribution.status)) {
            await session.abortTransaction();
            return;
        }

        if (resultCode === '0') {
            const mpesaItems = callback.CallbackMetadata?.Item || [];
            const receiptItem = mpesaItems.find(i => i.Name === 'MpesaReceiptNumber');
            const receipt = receiptItem?.Value;

            if (!receipt) {
                await session.abortTransaction();
                throw new ApiError(400, 'Missing receipt number');
            }

            const existing = await Contribution.findOne({ mpesaCode: receipt, status: 'completed' }).session(session);
            if (existing) {
                await session.abortTransaction();
                return;
            }

            contribution.status = 'completed';
            contribution.mpesaCode = receipt;

            const campaign = await Campaign.findById(contribution.campaign._id).session(session);
            campaign.currentAmount += contribution.amount;

            await Promise.all([contribution.save({ session }), campaign.save({ session })]);
        } else {
            contribution.status = 'failed';
            await contribution.save({ session });
        }

        await session.commitTransaction();
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

const checkContributionStatus = async (transactionId) => {
    const contribution = await Contribution.findOne({ transactionId });
    if (!contribution) throw new ApiError(404, 'Contribution not found');

    const ageMs = Date.now() - contribution.createdAt.getTime();
    if (contribution.status === 'pending' && ageMs > 30000) {
        try {
            const statusResponse = await mpesaService.checkTransactionStatus(transactionId);
            const mongoSession = await mongoose.startSession();
            mongoSession.startTransaction();

            const updateOperations = [];
            if (statusResponse.ResultCode === '0') {
                contribution.status = 'completed';
                contribution.mpesaCode = statusResponse.MpesaReceiptNumber;

                const campaign = await Campaign.findById(contribution.campaign).session(mongoSession);
                campaign.currentAmount += contribution.amount;
                updateOperations.push(campaign.save({ session: mongoSession }));
            } else {
                contribution.status = 'failed';
            }

            updateOperations.push(contribution.save({ session: mongoSession }));
            await Promise.all(updateOperations);
            await mongoSession.commitTransaction();
            mongoSession.endSession();
        } catch (error) {
            // Log silently and return current status
            console.error('Status check failed:', error.message);
        }
    }
    const finalStatus = await Contribution.findById(contribution._id);
    return finalStatus.status;
};

const processB2CResult = async (callbackData) => {
    const callbackResult = callbackData.Result || callbackData;
    if (!callbackResult) return { ResultCode: 1, ResultDesc: "Invalid format received" };

    const conversationID = callbackResult.ConversationID;
    const resultCode = callbackResult.ResultCode.toString();
    const resultDesc = callbackResult.ResultDesc;
    const transactionID = callbackResult.TransactionID;

    let mpesaReceiptNumber = null;
    if (callbackResult.ResultParameters && callbackResult.ResultParameters.ResultParameter) {
        const params = callbackResult.ResultParameters.ResultParameter;
        mpesaReceiptNumber = params.find(p => p.Key === 'TransactionReceipt')?.Value || transactionID;
    }

    if (!conversationID) return { ResultCode: 1, ResultDesc: "Missing ConversationID" };

    try {
        const campaign = await Campaign.findOne({ disbursementTransactionID: conversationID });
        if (!campaign) return { ResultCode: 0, ResultDesc: "Accepted - Campaign not found locally" };

        if (campaign.disbursementStatus === 'completed' || campaign.disbursementStatus === 'failed') {
            return { ResultCode: 0, ResultDesc: "Accepted - Duplicate callback ignored" };
        }

        if (resultCode === '0') {
            campaign.status = 'disbursed';
            campaign.disbursementStatus = 'completed';
            campaign.disbursementResultCode = resultCode;
            campaign.disbursementResultDesc = resultDesc;
            campaign.disbursementMpesaReceipt = mpesaReceiptNumber || transactionID;
        } else {
            campaign.status = 'disbursement_failed';
            campaign.disbursementStatus = 'failed';
            campaign.disbursementResultCode = resultCode;
            campaign.disbursementResultDesc = resultDesc;
        }

        await campaign.save();
        return { ResultCode: 0, ResultDesc: "Accepted" };
    } catch (dbError) {
        return { ResultCode: 1, ResultDesc: "Internal server error during processing" };
    }
};

const processB2CTimeout = async (callbackData) => {
    const callbackResult = callbackData.Result || callbackData;
    const conversationID = callbackResult.ConversationID || callbackResult.OriginatorConversationID;

    if (!conversationID) return { ResultCode: 1, ResultDesc: "Missing ConversationID in timeout" };

    try {
        const campaign = await Campaign.findOne({ disbursementTransactionID: conversationID });
        if (!campaign) return { ResultCode: 0, ResultDesc: "Accepted - Campaign not found locally (timeout)" };

        if (campaign.disbursementStatus === 'processing') {
            campaign.status = 'disbursement_failed';
            campaign.disbursementStatus = 'timeout';
            campaign.disbursementResultDesc = 'Transaction timed out waiting for response from M-Pesa.';
            await campaign.save();
        }

        return { ResultCode: 0, ResultDesc: "Accepted (Timeout)" };
    } catch (dbError) {
        return { ResultCode: 1, ResultDesc: "Internal server error during timeout processing" };
    }
};

module.exports = {
    createContribution,
    getAllContributions,
    getContributionById,
    updateContributionStatus,
    getUserContributions,
    getCampaignContributions,
    processPaymentCallback,
    checkContributionStatus,
    processB2CResult,
    processB2CTimeout
};
