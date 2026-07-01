const express = require('express');
const adminController = require('../controllers/admin.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { validate, adminSchemas } = require('../middleware/validation.middleware');
const router = express.Router();

// Admin routes
router.get('/dashboard-metrics', authMiddleware(['admin']), adminController.getDashboardMetrics);
router.get('/campaigns', authMiddleware(['admin']), adminController.getCampaigns);
router.post('/campaigns/:campaignId/end', authMiddleware(['admin']), adminController.postEndCampaign);
router.post('/campaigns/:campaignId/approve', authMiddleware(['admin']), adminController.postApproveCampaign);
router.post('/campaigns/:campaignId/reject', authMiddleware(['admin']), adminSchemas.rejectCampaign, validate, adminController.postRejectCampaign);
router.get('/campaign-contributors/:campaignId', authMiddleware(['admin']), adminController.getCampaignContributors);
router.get('/campaign-contribution-history/:campaignId', authMiddleware(['admin']), adminController.getCampaignContributionHistory);
router.get('/campaigns-list', authMiddleware(['admin']), adminController.getCampaignListForReports);
router.get('/reports/general-contributions', authMiddleware(['admin']), adminController.getGeneralContributionsReport);
router.get('/reports/campaign-specific', authMiddleware(['admin']), adminController.getCampaignSpecificReport);
router.get('/profile', authMiddleware(['admin']), adminController.getAdminProfile);
router.post('/change-password', authMiddleware(['admin']), adminSchemas.changePassword, validate, adminController.postChangePassword);

// --- NEW Disbursement Initiation Route ---
router.post('/campaigns/:campaignId/initiate-disbursement', authMiddleware(['admin']), adminSchemas.initiateDisbursement, validate, adminController.initiateDisbursement);
router.post('/campaigns', authMiddleware(['admin']), adminSchemas.createCampaign, validate, adminController.postCreateCampaign);

router.post('/users', authMiddleware(['admin']), adminSchemas.createUser, validate, adminController.postCreateUser);
router.post('/users/:userId/revoke', authMiddleware(['admin']), adminController.postRevokeUserAccess);
router.post('/users/:userId/extend-validity', authMiddleware(['admin']), adminSchemas.extendValidity, validate, adminController.postExtendUserValidity);
router.get('/users', authMiddleware(['admin']), adminController.getUsers);
router.post('/users/:userId/grant', authMiddleware(['admin']), adminController.postGrantUserAccess);

module.exports = router;