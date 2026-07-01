// routes/member.routes.js
const express = require('express');
const memberController = require('../controllers/member.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { validate, memberSchemas } = require('../middleware/validation.middleware');

const router = express.Router();

router.use(authMiddleware(['member']));

// Define routes
router.get('/campaigns', memberController.getCampaigns);
router.get('/contributions', memberController.getContributionHistory);
router.post('/contribute', memberController.postContribute);
router.get('/profile', memberController.getMemberProfile);
router.post('/inquiry', memberSchemas.submitInquiry, validate, memberController.postHelpInquiry);
router.put('/profile/update', memberSchemas.updateProfile, validate, memberController.updateMemberProfile);
router.post('/campaigns/apply', memberSchemas.applyCampaign, validate, memberController.postApplyForCampaign);
// New M-Pesa payment route
router.post('/mpesa-payment', memberController.initiateMpesaPayment);
router.get('/my-contributions', memberController.getMyContributionHistory);
router.get('/my-recent-activity', memberController.getMyRecentActivity);
router.put('/profile/change-password', memberSchemas.changePassword, validate, memberController.changePassword);

module.exports = router;