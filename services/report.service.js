const Campaign = require('../models/campaign.model');
const User = require('../models/user.model');
const Contribution = require('../models/contribution.model');
const { parse } = require('json2csv');
const ApiError = require('../utils/ApiError');

const getDashboardMetrics = async () => {
    const activeCampaignsCount = await Campaign.countDocuments({ status: 'active' });
    const pendingApprovalsCount = await Campaign.countDocuments({ status: 'pending_approval' });
    const totalMembersCount = await User.countDocuments({ role: 'member' });
    const totalFundsRaised = await Campaign.aggregate([
        {
            $group: {
                _id: null,
                totalRaised: { $sum: '$currentAmount' }
            }
        }
    ]);

    return {
        activeCampaignsCount,
        pendingApprovalsCount,
        totalMembersCount,
        totalFundsRaised: totalFundsRaised.length > 0 ? totalFundsRaised[0].totalRaised : 0,
    };
};

const getCampaignListForReports = () => {
    return [
        { id: 1, title: 'Medical Appeal for Student X' },
        { id: 2, title: 'Emergency Fund for Hostel Fire Victims' },
        { id: 3, title: 'Books and Supplies Drive' },
    ];
};

const getGeneralContributionsCursor = (startDate, endDate) => {
    let filter = {};
    if (startDate && endDate) {
        filter.paymentDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    return Contribution.find(filter)
        .populate('contributor', 'fullName email admissionNumber')
        .populate('campaign', 'title')
        .cursor();
};

const getCampaignSpecificCursor = (campaignId, startDate, endDate) => {
    if (!campaignId) throw new ApiError(400, 'Campaign ID is required.');
    let filter = { campaign: campaignId };
    if (startDate && endDate) {
        filter.paymentDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    return Contribution.find(filter)
        .populate('contributor', 'fullName email admissionNumber')
        .populate('campaign', 'title')
        .cursor();
};

module.exports = {
    getDashboardMetrics,
    getCampaignListForReports,
    getGeneralContributionsCursor,
    getCampaignSpecificCursor
};
