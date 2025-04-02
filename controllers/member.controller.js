// controllers/member.controller.js
const User = require('../models/user.model'); // Import User model
const Campaign = require('../models/campaign.model');
const Inquiry = require('../models/inquiry.model'); // Add import
const Contribution = require('../models/contribution.model'); // Add this line
const axios = require('axios');
const bcrypt = require('bcryptjs');
const mpesaService = require('../services/mpesa.service')

// Replace existing initiateMpesaPayment with:
exports.initiateMpesaPayment = async (req, res) => {

    const { phone, amount, campaignId } = req.body;
    console.log("Received request body for initiateMpesaPayment:", req.body);

    try {
        // Validate input
        if (!phone || !amount || !campaignId) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // Check campaign exists
        const campaign = await Campaign.findById(campaignId);
        if (!campaign) {
            return res.status(404).json({ message: 'Campaign not found' });
        }

        // Initiate payment
        const result = await mpesaService.initiateSTKPush(
            phone,
            amount,
            campaignId,
            req.user._id
        );

        res.json({
            message: 'Payment initiated successfully',
            data: {
                checkoutRequestId: result.CheckoutRequestID,
                responseCode: result.ResponseCode
            }
        });
    } catch (error) {
        console.error('M-Pesa payment error:', error.response?.data || error.message);
        res.status(500).json({
            message: 'Payment initiation failed',
            error: error.response?.data || error.message
        });
    }
};

exports.getCampaigns = async (req, res) => {
    try {
        console.log("Fetching active campaigns from MongoDB for members...");
        const activeCampaigns = await Campaign.find({ status: 'active' });
        console.log("Active campaigns fetched:", activeCampaigns);
        res.json(activeCampaigns);
    } catch (error) {
        console.error("Error fetching active campaigns:", error);
        res.status(500).json({ message: 'Failed to fetch active campaigns', error: error.message });
    }
};

exports.getContributionHistory = async (req, res) => {
    try {
        console.log("Fetching contribution history from MongoDB...");
        const contributions = await Contribution.find().populate('campaign').populate('contributor');
        console.log("Contribution history fetched:", contributions);
        res.json(contributions);
    } catch (error) {
        console.error("Error fetching contribution history:", error);
        res.status(500).json({ message: 'Failed to fetch contribution history', error: error.message });
    }
};

exports.getMyContributionHistory = async (req, res) => {
    try {
        console.log("Fetching contribution history for member from MongoDB...");
        const contributions = await Contribution.find({ contributor: req.user._id }) // Filter by logged-in user's ID
            .populate('campaign', 'title category') // Populate campaign details
            .sort({ paymentDate: -1 }); // Sort by payment date in descending order

        console.log("Member contribution history fetched:", contributions);
        res.json({ success: true, data: contributions });
    } catch (error) {
        console.error("Error fetching member contribution history:", error);
        res.status(500).json({ success: false, message: 'Failed to fetch contribution history', error: error.message });
    }
};

exports.getMyRecentActivity = async (req, res) => {
    try {
        console.log("Fetching recent activity for member from MongoDB...");
        const recentContributions = await Contribution.find({ contributor: req.user._id }) // Filter by logged-in user's ID
            .populate('campaign', 'title') // Populate campaign title only for brevity
            .sort({ paymentDate: -1 }) // Sort by payment date, newest first
            .limit(5); // Limit to the 5 most recent contributions

        console.log("Member recent activity fetched:", recentContributions);
        res.json({ success: true, data: recentContributions });
    } catch (error) {
        console.error("Error fetching member recent activity:", error);
        res.status(500).json({ success: false, message: 'Failed to fetch recent activity', error: error.message });
    }
};

exports.getMemberProfile = async (req, res) => {
    try {
        console.log("Fetching member profile from MongoDB...");
        const memberProfile = await User.findById(req.user._id).select('-password');
        if (!memberProfile) {
            return res.status(404).json({ message: 'Member profile not found' });
        }
        console.log("Member profile fetched:", memberProfile);
        res.json(memberProfile);
    } catch (error) {
        console.error("Error fetching member profile:", error);
        res.status(500).json({ message: 'Failed to fetch member profile', error: error.message });
    }
};

exports.postHelpInquiry = async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;
        const inquiry = new Inquiry({ name, email, subject, message });
        await inquiry.save();
        res.json({ message: 'Help inquiry submitted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to submit inquiry', error: error.message });
    }
};

exports.postContribute = async (req, res) => {
    try {
        const { campaignId, amount } = req.body;
        const contribution = new Contribution({
            amount,
            campaign: campaignId,
            contributor: req.user._id,
        });
        await contribution.save();
        await Campaign.findByIdAndUpdate(campaignId, { $inc: { currentAmount: amount } });
        res.json({ message: 'Contribution processed successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Contribution failed', error: error.message });
    }
};

exports.updateMemberProfile = async (req, res) => {
    console.log("Entering updateMemberProfile controller function");
    try {
        const { fullName } = req.body;
        const userId = req.user._id;

        console.log(`Updating member profile for user ID: ${userId}`); // <--- ADD THIS LOG
        console.log('Update request body:', req.body); // <--- ADD THIS LOG

        if (!fullName) {
            return res.status(400).json({ message: 'Full name is required for profile update.' });
        }

        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { fullName: fullName },
            { new: true, runValidators: true }
        ).select('-password');

        console.log('Updated User (after findByIdAndUpdate):', updatedUser); // <--- ADD THIS LOG

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }

        console.log('Member profile updated successfully:', updatedUser);
        res.json({ message: 'Profile updated successfully', user: updatedUser });

    } catch (error) {
        console.error('Error updating member profile:', error); // Keep this error log
        res.status(400).json({ message: 'Failed to update profile', error: error.message });
    }
};

exports.postApplyForCampaign = async (req, res) => {
    console.log("postApplyForCampaign controller function CALLED!");
    console.log("Request Body:", req.body);
    try {
        const { title, description, details, category, goalAmount, endDate } = req.body;
        const createdBy = req.user._id;
        if (!title || !description || !category || !goalAmount || !endDate) {
            return res.status(400).json({ message: 'Missing required fields (Title, Description, Category, Goal Amount, End Date)' });
        }
        const newCampaign = new Campaign({
            title,
            description,
            details,
            category,
            goalAmount,
            endDate,
            createdBy: createdBy,
            status: 'pending_approval'
        });
        const savedCampaign = await newCampaign.save();
        console.log("Campaign application saved successfully:", savedCampaign);
        // Remove trackingNumber from response
        const responseCampaign = savedCampaign.toObject();
        delete responseCampaign.trackingNumber; // Explicitly remove if needed, though it shouldn't exist
        // delete responseCampaign.__v;

        res.status(201).json({ message: 'Campaign application submitted successfully', campaign: responseCampaign });
    } catch (error) {
        console.error("Error in campaign application submission:", error);
        res.status(400).json({ message: 'Campaign application failed', error: error.message });
    }
};

exports.changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user._id;

    // Basic validation
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Current and new passwords are required.' });
    }

    // Add more robust validation for new password complexity if needed here
    // Example: Check length, characters etc. (similar to model validation)
    if (newPassword.length < 8) {
        return res.status(400).json({ message: 'New password must be at least 8 characters long.' });
    }
    // You could add regex checks here too for complexity

    try {
        // Fetch user WITH password field
        const user = await User.findById(userId).select('+password'); // Use .select('+password') if excluded by default

        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Incorrect current password.' });
        }

   
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);

     
        await user.save();

        res.json({ message: 'Password updated successfully.' });

    } catch (error) {
        console.error('Member password change error:', error);
        res.status(500).json({ message: 'Failed to change password.', error: error.message });
    }
};
