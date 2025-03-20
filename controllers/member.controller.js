// controllers/member.controller.js
const User = require('../models/user.model'); // Import User model
const Campaign = require('../models/campaign.model');
const Inquiry = require('../models/inquiry.model'); // Add import
const Contribution = require('../models/contribution.model'); // Add this line

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