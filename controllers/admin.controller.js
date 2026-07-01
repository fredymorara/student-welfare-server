const catchAsync = require('../utils/catchAsync');
const campaignService = require('../services/campaign.service');
const userService = require('../services/user.service');
const reportService = require('../services/report.service');
const ApiError = require('../utils/ApiError');

// --- Campaign Handlers ---

exports.getCampaigns = catchAsync(async (req, res) => {
    const { page, limit } = req.query;
    const data = await campaignService.getAllCampaigns(page, limit);
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

exports.getCampaignContributors = catchAsync(async (req, res) => {
    const { campaignId } = req.params;
    const contributors = await campaignService.getCampaignContributors(campaignId);
    res.json(contributors);
});

exports.getCampaignContributionHistory = catchAsync(async (req, res) => {
    const { campaignId } = req.params;
    const history = await campaignService.getCampaignContributionHistory(campaignId);
    res.json(history);
});

exports.postCreateCampaign = catchAsync(async (req, res) => {
    const campaign = await campaignService.createCampaign(req.body, req.user._id);
    res.status(201).json({ message: 'Campaign created successfully', campaign });
});

exports.postEndCampaign = catchAsync(async (req, res) => {
    const { campaignId } = req.params;
    const campaign = await campaignService.updateCampaignStatus(campaignId, 'ended');
    res.json({ message: `Campaign ${campaignId} ended successfully`, campaign });
});

exports.postApproveCampaign = catchAsync(async (req, res) => {
    const { campaignId } = req.params;
    const campaign = await campaignService.updateCampaignStatus(campaignId, 'active');
    res.json({ message: `Campaign ${campaignId} approved successfully`, campaign });
});

exports.postRejectCampaign = catchAsync(async (req, res) => {
    const { campaignId } = req.params;
    const { rejectionReason } = req.body;
    const campaign = await campaignService.updateCampaignStatus(campaignId, 'rejected', { rejectionReason });
    res.json({ message: `Campaign ${campaignId} rejected successfully`, campaign });
});

exports.initiateDisbursement = catchAsync(async (req, res) => {
    const { campaignId } = req.params;
    const adminUserId = req.user._id;
    const result = await campaignService.initiateDisbursement(campaignId, req.body, adminUserId);
    res.status(200).json({
        message: 'Disbursement initiated successfully. Waiting for M-Pesa confirmation.',
        ...result
    });
});

// --- User Handlers ---

exports.getUsers = catchAsync(async (req, res) => {
    const { page, limit } = req.query;
    const data = await userService.getAllUsers(page, limit);
    res.json({
        success: true,
        data: data.users,
        meta: {
            total: data.count,
            page: data.page,
            limit: data.limit,
            pages: data.pages
        }
    });
});

exports.postCreateUser = catchAsync(async (req, res) => {
    const user = await userService.createUser(req.body);
    res.status(201).json({ message: 'User created successfully', user });
});

exports.postRevokeUserAccess = catchAsync(async (req, res) => {
    const { userId } = req.params;
    const user = await userService.updateUserStatus(userId, false);
    res.json({ message: 'User access revoked successfully', user });
});

exports.postGrantUserAccess = catchAsync(async (req, res) => {
    const { userId } = req.params;
    const user = await userService.updateUserStatus(userId, true);
    res.json({ message: 'User access granted', user });
});

exports.postExtendUserValidity = catchAsync(async (req, res) => {
    const { userId } = req.params;
    const { validUntil } = req.body;
    const user = await userService.extendUserValidity(userId, validUntil);
    res.json({ message: 'User validity extended successfully', user });
});

exports.getAdminProfile = catchAsync(async (req, res) => {
    const adminProfile = await userService.getAdminProfile(req.user._id);
    res.json(adminProfile);
});

exports.postChangePassword = catchAsync(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    await userService.changeAdminPassword(req.user._id, currentPassword, newPassword);
    res.json({ message: 'Admin password changed successfully.' });
});

// --- Report & Metrics Handlers ---

exports.getDashboardMetrics = catchAsync(async (req, res) => {
    const metrics = await reportService.getDashboardMetrics();
    res.json(metrics);
});

exports.getCampaignListForReports = (req, res) => {
    const list = reportService.getCampaignListForReports();
    res.json(list);
};

const { Transform } = require('stream');

const createCsvTransform = () => {
    return new Transform({
        objectMode: true,
        transform(doc, encoding, callback) {
            const escapeCsv = (str) => {
                if (str == null) return '';
                const stringified = String(str);
                if (stringified.includes(',') || stringified.includes('"') || stringified.includes('\n')) {
                    return `"${stringified.replace(/"/g, '""')}"`;
                }
                return stringified;
            };

            const row = [
                doc.paymentDate ? doc.paymentDate.toISOString() : '',
                doc.amount || '',
                doc.paymentMethod || '',
                doc.status || '',
                escapeCsv(doc.contributor?.fullName),
                escapeCsv(doc.contributor?.email),
                escapeCsv(doc.contributor?.admissionNumber),
                escapeCsv(doc.campaign?.title)
            ].join(',');
            
            callback(null, row + '\n');
        }
    });
};

exports.getGeneralContributionsReport = catchAsync(async (req, res) => {
    const { startDate, endDate, format } = req.query;
    if (format !== 'csv') {
        throw new ApiError(400, 'Invalid or unsupported report format requested.');
    }

    res.header('Content-Type', 'text/csv');
    res.attachment('general-contributions-report.csv');
    res.write('paymentDate,amount,paymentMethod,status,contributor.fullName,contributor.email,contributor.admissionNumber,campaign.title\n');

    const cursor = reportService.getGeneralContributionsCursor(startDate, endDate);
    cursor.pipe(createCsvTransform()).pipe(res);
});

exports.getCampaignSpecificReport = catchAsync(async (req, res) => {
    const { campaignId, startDate, endDate, format } = req.query;
    if (format !== 'csv') {
        throw new ApiError(400, 'Invalid or unsupported report format requested.');
    }

    res.header('Content-Type', 'text/csv');
    res.attachment(`campaign-${campaignId}-report.csv`);
    res.write('paymentDate,amount,paymentMethod,status,contributor.fullName,contributor.email,contributor.admissionNumber,campaign.title\n');

    const cursor = reportService.getCampaignSpecificCursor(campaignId, startDate, endDate);
    cursor.pipe(createCsvTransform()).pipe(res);
});
