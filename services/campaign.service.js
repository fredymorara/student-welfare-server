const Campaign = require('../models/campaign.model');
const User = require('../models/user.model');
const Contribution = require('../models/contribution.model');
const mpesaService = require('./mpesa.service');
const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');
const cache = require('../utils/cache');

const getAllCampaigns = async (page = 1, limit = 10) => {
    const campaigns = await Campaign.find()
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ createdAt: -1 });

    const count = await Campaign.countDocuments();
    return {
        campaigns,
        count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
    };
};

const getCampaignContributors = async (campaignId) => {
    const contributors = await Contribution.aggregate([
        { $match: { campaign: new mongoose.Types.ObjectId(campaignId) } },
        { $group: { _id: "$contributor" } },
        {
            $lookup: {
                from: "users",
                localField: "_id",
                foreignField: "_id",
                as: "user"
            }
        },
        { $unwind: "$user" },
        {
            $project: {
                _id: 0,
                memberName: "$user.fullName"
            }
        }
    ]);
    return contributors;
};

const getCampaignContributionHistory = async (campaignId) => {
    const contributionHistory = await Contribution.find({ campaign: campaignId })
        .populate('contributor', 'fullName')
        .sort({ paymentDate: -1 });

    return contributionHistory.map(contribution => ({
        memberName: contribution.contributor ? contribution.contributor.fullName : 'Guest Contributor',
        amount: contribution.amount,
        contributionDate: contribution.paymentDate,
        transactionId: contribution.transactionId,
        paymentMethod: contribution.paymentMethod,
        status: contribution.status,
    }));
};

const createCampaign = async (campaignData, userId) => {
    const { title, description, category, goalAmount, endDate, details } = campaignData;
    if (!title || !description || !category || !goalAmount || !endDate) {
        throw new ApiError(400, 'Missing required fields (Title, Description, Category, Goal Amount, End Date)');
    }
    const newCampaign = new Campaign({
        title,
        description,
        details,
        category,
        goalAmount,
        endDate,
        createdBy: userId,
        status: 'active'
    });
    const savedCampaign = await newCampaign.save();
    cache.flushAll(); // Clear cache when new active campaign is created
    return {
        _id: savedCampaign._id,
        title: savedCampaign.title,
        status: savedCampaign.status,
        goalAmount: savedCampaign.goalAmount,
        endDate: savedCampaign.endDate
    };
};

const updateCampaignStatus = async (campaignId, status, additionalData = {}) => {
    const updateData = { status, ...additionalData };
    if (status === 'ended') updateData.endDate = Date.now();
    
    const campaign = await Campaign.findByIdAndUpdate(campaignId, updateData, { new: true, runValidators: true });
    if (!campaign) {
        throw new ApiError(404, 'Campaign not found');
    }
    cache.flushAll(); // Clear active campaigns cache
    return campaign;
};

const initiateDisbursement = async (campaignId, disbursementData, adminUserId) => {
    const { recipientPhone, amount, recipientName, remarks } = disbursementData;

    if (!recipientPhone || !amount) {
        throw new ApiError(400, 'Recipient phone number and amount are required.');
    }
    if (isNaN(amount) || Number(amount) <= 0) {
        throw new ApiError(400, 'Invalid disbursement amount.');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const campaign = await Campaign.findById(campaignId).session(session);

        if (!campaign) {
            throw new ApiError(404, 'Campaign not found.');
        }

        if (campaign.status !== 'ended') {
            throw new ApiError(400, `Campaign must be in 'ended' state to disburse. Current state: ${campaign.status}`);
        }
        if (Number(amount) > campaign.currentAmount) {
            throw new ApiError(400, `Disbursement amount (${amount}) exceeds available funds (${campaign.currentAmount}).`);
        }
        
        if (['disbursing', 'disbursed'].includes(campaign.status) || campaign.disbursementStatus === 'processing' || campaign.disbursementStatus === 'completed') {
            throw new ApiError(400, `Campaign funds are already being processed or have been disbursed. Status: ${campaign.status}, Disbursement Status: ${campaign.disbursementStatus}`);
        }

        const mpesaResult = await mpesaService.initiateB2CPayment(
            recipientPhone,
            amount,
            remarks || `Disbursement for ${campaign.title.substring(0, 50)}`
        );

        campaign.status = 'disbursing';
        campaign.disbursementStatus = 'processing';
        campaign.disbursementAmount = Number(amount);
        campaign.disbursementDate = new Date();
        campaign.disbursementMethod = 'M-Pesa B2C';
        campaign.disbursementRecipientPhone = recipientPhone;
        campaign.disbursementRecipientName = recipientName;
        campaign.disbursementDetails = remarks;
        campaign.disbursementInitiatedBy = adminUserId;
        campaign.disbursementTransactionID = mpesaResult.ConversationID;
        campaign.disbursementResultCode = null;
        campaign.disbursementResultDesc = null;
        campaign.disbursementMpesaReceipt = null;

        await campaign.save({ session });
        await session.commitTransaction();
        session.endSession();

        return {
            conversationId: mpesaResult.ConversationID,
            campaignStatus: campaign.status,
            disbursementStatus: campaign.disbursementStatus
        };

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        throw new ApiError(500, error.message || 'Disbursement initiation failed.');
    }
};

module.exports = {
    getAllCampaigns,
    getCampaignContributors,
    getCampaignContributionHistory,
    createCampaign,
    updateCampaignStatus,
    initiateDisbursement
};
