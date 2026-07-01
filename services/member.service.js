const User = require('../models/user.model');
const Campaign = require('../models/campaign.model');
const Inquiry = require('../models/inquiry.model');
const Contribution = require('../models/contribution.model');
const mpesaService = require('./mpesa.service');
const ApiError = require('../utils/ApiError');
const bcrypt = require('bcryptjs');
const cache = require('../utils/cache');

const initiateMpesaPayment = async (phone, amount, campaignId, userId) => {
    if (!phone || !amount || !campaignId) {
        throw new ApiError(400, 'Missing required fields');
    }

    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
        throw new ApiError(404, 'Campaign not found');
    }

    return await mpesaService.initiateSTKPush(phone, amount, campaignId, userId);
};

const getActiveCampaigns = async (page = 1, limit = 10) => {
    const cacheKey = `active_campaigns_${page}_${limit}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) return cachedData;

    const filter = { status: 'active' };
    const campaigns = await Campaign.find(filter)
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ createdAt: -1 });

    const count = await Campaign.countDocuments(filter);
    const result = {
        campaigns,
        count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
    };
    
    cache.set(cacheKey, result);
    return result;
};

const getAllContributionHistory = async () => {
    return await Contribution.find().populate('campaign').populate('contributor');
};

const getMyContributionHistory = async (userId) => {
    return await Contribution.find({ contributor: userId })
        .populate('campaign', 'title category')
        .sort({ paymentDate: -1 });
};

const getMyRecentActivity = async (userId) => {
    return await Contribution.find({ contributor: userId })
        .populate('campaign', 'title')
        .sort({ paymentDate: -1 })
        .limit(5);
};

const getMemberProfile = async (userId) => {
    const profile = await User.findById(userId).select('-password');
    if (!profile) throw new ApiError(404, 'Member profile not found');
    return profile;
};

const submitHelpInquiry = async (inquiryData) => {
    const { name, email, subject, message } = inquiryData;
    const inquiry = new Inquiry({ name, email, subject, message });
    await inquiry.save();
    return inquiry;
};

const processContribution = async (campaignId, amount, userId) => {
    const contribution = new Contribution({
        amount,
        campaign: campaignId,
        contributor: userId,
    });
    await contribution.save();
    await Campaign.findByIdAndUpdate(campaignId, { $inc: { currentAmount: amount } });
    return contribution;
};

const updateMemberProfile = async (userId, fullName) => {
    if (!fullName) {
        throw new ApiError(400, 'Full name is required for profile update.');
    }

    const updatedUser = await User.findByIdAndUpdate(
        userId,
        { fullName },
        { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) throw new ApiError(404, 'User not found');
    return updatedUser;
};

const applyForCampaign = async (campaignData, userId) => {
    const { title, description, details, category, goalAmount, endDate } = campaignData;
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
        status: 'pending_approval'
    });

    const savedCampaign = await newCampaign.save();
    const responseCampaign = savedCampaign.toObject();
    delete responseCampaign.trackingNumber;

    return responseCampaign;
};

const changePassword = async (userId, currentPassword, newPassword) => {
    if (!currentPassword || !newPassword) {
        throw new ApiError(400, 'Current and new passwords are required.');
    }
    if (newPassword.length < 8) {
        throw new ApiError(400, 'New password must be at least 8 characters long.');
    }

    const user = await User.findById(userId).select('+password');
    if (!user) throw new ApiError(404, 'User not found.');

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) throw new ApiError(400, 'Incorrect current password.');

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();
};

module.exports = {
    initiateMpesaPayment,
    getActiveCampaigns,
    getAllContributionHistory,
    getMyContributionHistory,
    getMyRecentActivity,
    getMemberProfile,
    submitHelpInquiry,
    processContribution,
    updateMemberProfile,
    applyForCampaign,
    changePassword
};
