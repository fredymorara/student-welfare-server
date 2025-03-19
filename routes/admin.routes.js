// routes/admin.routes.js
const express = require('express');
const adminController = require('../controllers/admin.controller'); // Import the admin controller
const authMiddleware = require('../middleware/auth.middleware');
const router = express.Router(); // Create an express router instance

// Define routes for admin functionalities
router.get('/dashboard-metrics', authMiddleware(['admin']), adminController.getDashboardMetrics); // Route to get dashboard metrics
router.get('/campaigns', authMiddleware(['admin']), adminController.getCampaigns); // Route to get all campaigns (for management)
router.post('/campaigns/:campaignId/end', authMiddleware(['admin']), adminController.postEndCampaign); // Route to end a campaign
router.post('/campaigns/:campaignId/approve', authMiddleware(['admin']), adminController.postApproveCampaign); // Route to approve a campaign
router.post('/campaigns/:campaignId/reject', authMiddleware(['admin']), adminController.postRejectCampaign); // Route to reject a campaign
router.post('/campaigns/:campaignId/disburse', authMiddleware(['admin']), adminController.postDisburseFunds); // Route to disburse funds for a campaign
router.get('/campaign-contributors/:campaignId', authMiddleware(['admin']), adminController.getCampaignContributors); // Route to get contributors for a campaign
router.get('/campaign-contribution-history/:campaignId', authMiddleware(['admin']), adminController.getCampaignContributionHistory); // Route to get contribution history for a campaign
router.get('/campaigns-list', authMiddleware(['admin']), adminController.getCampaignListForReports); // Route to get campaign list for reports dropdown
router.get('/reports/general-contributions', authMiddleware(['admin']), adminController.getGeneralContributionsReport); // Route to generate general contributions report
router.get('/reports/campaign-specific', authMiddleware(['admin']), adminController.getCampaignSpecificReport); // Route to generate campaign-specific report
router.get('/profile', authMiddleware(['admin']), adminController.getAdminProfile); // Route to get admin profile data
router.post('/change-password', authMiddleware(['admin']), adminController.postChangePassword); // Route to change admin password
router.post('/campaigns', authMiddleware(['admin']), adminController.postCreateCampaign);// <--- ADD THIS LINE: Route for creating a new campaign
router.post('/users', authMiddleware(['admin']), adminController.postCreateUser); // <--- ADD THIS LINE: Route for creating a new user
router.post('/users/:userId/revoke', authMiddleware(['admin']), adminController.postRevokeUserAccess); // <--- ADD THIS LINE: Route for revoking user access
router.post('/users/:userId/extend-validity', authMiddleware(['admin']), adminController.postExtendUserValidity); // <--- ADD THIS LINE: Route for extending user validity
router.get('/users', authMiddleware(['admin']), adminController.getUsers); // <--- ADD THIS LINE: Route for getting a list of users



module.exports = router; // Export the router