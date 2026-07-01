const catchAsync = require('../utils/catchAsync');
const memberService = require('../services/member.service');

exports.initiateMpesaPayment = catchAsync(async (req, res) => {
    const { phone, amount, campaignId } = req.body;
    const result = await memberService.initiateMpesaPayment(phone, amount, campaignId, req.user._id);
    res.json({
        message: 'Payment initiated successfully',
        data: {
            checkoutRequestId: result.CheckoutRequestID,
            responseCode: result.ResponseCode
        }
    });
});

exports.getCampaigns = catchAsync(async (req, res) => {
    const { page, limit } = req.query;
    const data = await memberService.getActiveCampaigns(page, limit);
    res.json({
        success: true,
        data: data.campaigns,
        meta: {
            total: data.count,
            page: data.page,
            limit: data.limit,
            pages: data.pages
        }
    });
});

exports.getContributionHistory = catchAsync(async (req, res) => {
    const contributions = await memberService.getAllContributionHistory();
    res.json(contributions);
});

exports.getMyContributionHistory = catchAsync(async (req, res) => {
    const contributions = await memberService.getMyContributionHistory(req.user._id);
    res.json({ success: true, data: contributions });
});

exports.getMyRecentActivity = catchAsync(async (req, res) => {
    const recentContributions = await memberService.getMyRecentActivity(req.user._id);
    res.json({ success: true, data: recentContributions });
});

exports.getMemberProfile = catchAsync(async (req, res) => {
    const profile = await memberService.getMemberProfile(req.user._id);
    res.json(profile);
});

exports.postHelpInquiry = catchAsync(async (req, res) => {
    await memberService.submitHelpInquiry(req.body);
    res.json({ message: 'Help inquiry submitted successfully' });
});

exports.postContribute = catchAsync(async (req, res) => {
    const { campaignId, amount } = req.body;
    await memberService.processContribution(campaignId, amount, req.user._id);
    res.json({ message: 'Contribution processed successfully' });
});

exports.updateMemberProfile = catchAsync(async (req, res) => {
    const { fullName } = req.body;
    const updatedUser = await memberService.updateMemberProfile(req.user._id, fullName);
    res.json({ message: 'Profile updated successfully', user: updatedUser });
});

exports.postApplyForCampaign = catchAsync(async (req, res) => {
    const campaign = await memberService.applyForCampaign(req.body, req.user._id);
    res.status(201).json({ message: 'Campaign application submitted successfully', campaign });
});

exports.changePassword = catchAsync(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    await memberService.changePassword(req.user._id, currentPassword, newPassword);
    res.json({ message: 'Password updated successfully.' });
});
