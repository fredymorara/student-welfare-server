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
        const createdBy = req.user._id; // Get member's user ID from auth middleware

        const newCampaign = new Campaign({
            title,
            description,
            details,
            category,
            goalAmount,
            endDate,
            createdBy: createdBy, // Set createdBy to the member's ID
            status: 'pending_approval' // Default status for member applications
            // trackingNumber will be auto-generated or assigned by admin later, so no need to set it here
        });

        console.log("New Campaign Application Object (before save):", newCampaign);

        const savedCampaign = await newCampaign.save();

        console.log("Campaign application saved successfully:", savedCampaign);

        res.status(201).json({ message: 'Campaign application submitted successfully', campaign: savedCampaign });
    } catch (error) {
        console.error("Error in campaign application submission:", error);
        res.status(400).json({ message: 'Campaign application failed', error: error.message });
    }
};