// controllers/admin.controller.js
const Campaign = require('../models/campaign.model'); // Import Campaign model
const User = require('../models/user.model'); // Import User model (for dashboard metrics - member count)
const bcrypt = require('bcryptjs'); // Import bcrypt for password hashing (install if you haven't
const { parse } = require('json2csv');
const Contribution = require('../models/contribution.model');
const mpesaService = require('../services/mpesa.service'); // Add this line
const mongoose = require('mongoose');

exports.getCampaigns = async (req, res) => {
    try {
        console.log("Fetching campaigns from MongoDB..."); // Added log: Request received
        const campaigns = await Campaign.find();
        console.log("Campaigns fetched:", campaigns); // Added log: Data from DB
        res.json(campaigns);
    } catch (error) {
        console.error("Error fetching campaigns:", error); // Added log: Error
        res.status(500).json({ message: error.message });
    }
};

exports.getCampaignContributors = async (req, res) => {
    const { campaignId } = req.params;
    try {
        console.log(`Fetching contributors for campaign ID: ${campaignId}`);
        const contributions = await Contribution.find({ campaign: campaignId })
            .populate('contributor', 'fullName') // Populate contributor's full name
            .distinct('contributor'); // Get distinct contributor IDs

        const uniqueContributors = await User.find({ _id: { $in: contributions } }); // Fetch user details for distinct contributors

        const formattedContributors = uniqueContributors.map(user => ({
            memberName: user.fullName, // Or however you want to display member name
            // You can add more fields if needed, e.g., user.email, user.admissionNumber
        }));

        console.log(`Found ${formattedContributors.length} contributors for campaign ID: ${campaignId}`);
        res.json(formattedContributors);
    } catch (error) {
        console.error("Error fetching campaign contributors:", error);
        res.status(500).json({ message: 'Failed to fetch campaign contributors', error: error.message });
    }
};

exports.getCampaignContributionHistory = async (req, res) => {
    const { campaignId } = req.params;
    try {
        console.log(`Fetching contribution history for campaign ID: ${campaignId}`);
        const contributionHistory = await Contribution.find({ campaign: campaignId })
            .populate('contributor', 'fullName') // Populate contributor's full name
            .sort({ paymentDate: -1 }); // Sort by payment date, newest first

        const formattedHistory = contributionHistory.map(contribution => ({
            memberName: contribution.contributor ? contribution.contributor.fullName : 'Guest Contributor', // Handle cases where contributor might be null
            amount: contribution.amount,
            contributionDate: contribution.paymentDate,
            transactionId: contribution.transactionId,
            paymentMethod: contribution.paymentMethod, // Include payment method
            status: contribution.status,           // Include payment status
            // Add more fields as needed
        }));

        console.log(`Found ${formattedHistory.length} contribution records for campaign ID: ${campaignId}`);
        res.json(formattedHistory);
    } catch (error) {
        console.error("Error fetching campaign contribution history:", error);
        res.status(500).json({ message: 'Failed to fetch campaign contribution history', error: error.message });
    }
};

exports.getDashboardMetrics = async (req, res) => {
    try {
        console.log("Fetching dashboard metrics from MongoDB...");
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

        const metrics = {
            activeCampaignsCount,
            pendingApprovalsCount,
            totalMembersCount,
            totalFundsRaised: totalFundsRaised.length > 0 ? totalFundsRaised[0].totalRaised : 0,
        };
        console.log("Dashboard metrics fetched successfully:", metrics); // Success log
        res.json(metrics);
    } catch (error) {
        console.error("Error fetching dashboard metrics:", error); // Error log
        res.status(500).json({ message: 'Failed to fetch dashboard metrics', error: error.message }); // More descriptive error message
    }
};

exports.postEndCampaign = async (req, res) => {
    const { campaignId } = req.params;
    try {
        const campaign = await Campaign.findByIdAndUpdate(
            campaignId, // Find campaign by ID
            { status: 'ended', endDate: Date.now() }, // Update status to 'ended' and set endDate to now
            { new: true, runValidators: true } // Options: return updated doc, run schema validators
        );

        if (!campaign) {
            return res.status(404).json({ message: 'Campaign not found' }); // Handle case where campaign ID is invalid
        }

        res.json({ message: `Campaign ${campaignId} ended successfully`, campaign }); // Respond with success message and updated campaign
    } catch (error) {
        res.status(500).json({ message: error.message }); // Handle errors
    }
};

exports.postCreateCampaign = async (req, res) => {
    console.log("postCreateCampaign controller function CALLED!");
    try {
        const { title, description, category, goalAmount, endDate, details } = req.body;
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
            createdBy: req.user._id,
            status: 'active'
        });
        const savedCampaign = await newCampaign.save();
        res.status(201).json({
            message: 'Campaign created successfully',
            campaign: { // Remove trackingNumber from response
                _id: savedCampaign._id,
                title: savedCampaign.title,
                status: savedCampaign.status,
                goalAmount: savedCampaign.goalAmount,
                endDate: savedCampaign.endDate
            }
        });
    } catch (error) {
        console.error("Campaign creation error:", error);
        res.status(400).json({
            message: 'Campaign creation failed',
            error: error.message,
            validationErrors: error.errors ? Object.values(error.errors).map(e => e.message) : []
        });
    }
};

exports.getUsers = async (req, res) => {
    try {
        const users = await User.find().select('-password'); // Fetch all users from MongoDB, excluding password field

        res.json(users); // Respond with the list of users in JSON format

    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch users', error: error.message }); // Handle errors
    }
};

exports.postApproveCampaign = async (req, res) => {
    const { campaignId } = req.params;
    try {
        const campaign = await Campaign.findByIdAndUpdate(
            campaignId,
            { status: 'active' }, // Update status to 'active'
            { new: true, runValidators: true }
        );

        if (!campaign) {
            return res.status(404).json({ message: 'Campaign not found' });
        }

        res.json({ message: `Campaign ${campaignId} approved successfully`, campaign });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.postRejectCampaign = async (req, res) => {
    const { campaignId } = req.params;
    const { rejectionReason } = req.body; // Get rejection reason from request body
    try {
        const campaign = await Campaign.findByIdAndUpdate(
            campaignId,
            { status: 'rejected', rejectionReason }, // Update status to 'rejected' and set rejectionReason
            { new: true, runValidators: true }
        );

        if (!campaign) {
            return res.status(404).json({ message: 'Campaign not found' });
        }

        res.json({ message: `Campaign ${campaignId} rejected successfully`, campaign });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.initiateDisbursement = async (req, res) => {
    const { campaignId } = req.params;
    // Extract recipientPhone, amount, recipientName (optional), remarks (optional) from body
    const { recipientPhone, amount, recipientName, remarks } = req.body;
    const adminUserId = req.user._id; // Admin initiating the request

    console.log(`Initiating disbursement for Campaign ${campaignId}:`, { recipientPhone, amount, recipientName, remarks });

    // Basic Input Validation
    if (!recipientPhone || !amount) {
        return res.status(400).json({ message: 'Recipient phone number and amount are required.' });
    }
    if (isNaN(amount) || Number(amount) <= 0) {
        return res.status(400).json({ message: 'Invalid disbursement amount.' });
    }

    const session = await mongoose.startSession(); // Use transaction
    session.startTransaction();

    try {
        // 1. Find the campaign
        const campaign = await Campaign.findById(campaignId).session(session);

        if (!campaign) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: 'Campaign not found.' });
        }

        // 2. Check Campaign Status and Funds
        // Allow disbursement from 'active' or 'ended' status? Let's allow 'ended' for now.
        if (campaign.status !== 'ended') {
            // You might adjust this logic if partial disbursements from 'active' are allowed
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: `Campaign must be in 'ended' state to disburse. Current state: ${campaign.status}` });
        }
        if (Number(amount) > campaign.currentAmount) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: `Disbursement amount (${amount}) exceeds available funds (${campaign.currentAmount}).` });
        }
        // Prevent re-disbursing if already completed or in progress
        if (['disbursing', 'disbursed'].includes(campaign.status) || campaign.disbursementStatus === 'processing' || campaign.disbursementStatus === 'completed') {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: `Campaign funds are already being processed or have been disbursed. Status: ${campaign.status}, Disbursement Status: ${campaign.disbursementStatus}` });
        }


        // 3. Initiate B2C Payment via Service
        console.log("Calling mpesaService.initiateB2CPayment...");
        const mpesaResult = await mpesaService.initiateB2CPayment(
            recipientPhone,
            amount,
            remarks || `Disbursement for ${campaign.title.substring(0, 50)}` // Use provided remarks or default
        );

        // mpesaResult should contain { success: true, ConversationID, OriginatorConversationID, ResponseDescription }
        console.log("Mpesa B2C Initiation Result:", mpesaResult);

        // 4. Update Campaign Record (if initiation accepted by M-Pesa)
        campaign.status = 'disbursing'; // Update main status
        campaign.disbursementStatus = 'processing'; // Track B2C status
        campaign.disbursementAmount = Number(amount);
        campaign.disbursementDate = new Date();
        campaign.disbursementMethod = 'M-Pesa B2C';
        campaign.disbursementRecipientPhone = recipientPhone;
        campaign.disbursementRecipientName = recipientName; // Store optional name
        campaign.disbursementDetails = remarks; // Store optional remarks
        campaign.disbursementInitiatedBy = adminUserId;
        // Store the ConversationID received from M-Pesa to link the callback
        campaign.disbursementTransactionID = mpesaResult.ConversationID;
        campaign.disbursementResultCode = null; // Clear previous results if any
        campaign.disbursementResultDesc = null;
        campaign.disbursementMpesaReceipt = null;


        // You *could* deduct the amount from currentAmount here, but it might be safer
        // to wait for the 'completed' callback to be absolutely sure. Let's wait.
        // campaign.currentAmount -= Number(amount); // Decide if you want to deduct now or on success callback

        await campaign.save({ session });

        // 5. Commit Transaction
        await session.commitTransaction();
        session.endSession();

        console.log(`Campaign ${campaignId} status updated to 'disbursing'. Waiting for M-Pesa callback.`);

        // 6. Respond to Admin Frontend
        res.status(200).json({
            message: 'Disbursement initiated successfully. Waiting for M-Pesa confirmation.',
            conversationId: mpesaResult.ConversationID, // Send back ID for reference
            campaignStatus: campaign.status,
            disbursementStatus: campaign.disbursementStatus
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error(`Error initiating disbursement for campaign ${campaignId}:`, error);
        res.status(500).json({
            message: 'Disbursement initiation failed.',
            // Send back a more specific error if it's from M-Pesa service
            error: error.message || 'Internal server error'
        });
    }
};

exports.postCreateUser = async (req, res) => {
    try {
        const { admissionNumber, fullName, schoolFaculty, email, password, role } = req.body; // Extract user data from request body

        // Hash the password before saving to the database
        const hashedPassword = await bcrypt.hash(password, 10); // 10 is the saltRounds

        // Create a new User document instance
        const newUser = new User({
            admissionNumber,
            fullName,
            schoolFaculty,
            email,
            password: hashedPassword, // Store the hashed password
            role,
            // isActive will default to true as defined in the model
        });

        // Save the new user to the database
        const savedUser = await newUser.save();

        // Exclude password from the response for security
        const userResponse = savedUser.toObject(); // Convert Mongoose document to plain object
        delete userResponse.password; // Remove password field

        res.status(201).json({ message: 'User created successfully', user: userResponse }); // Respond with 201 Created and user data (without password)

    } catch (error) {
        res.status(400).json({ message: 'User creation failed', error: error.message }); // Respond with 400 Bad Request for validation errors
    }
};

exports.postRevokeUserAccess = async (req, res) => {
    const { userId } = req.params; // Extract userId from URL parameters

    try {
        const user = await User.findByIdAndUpdate(
            userId, // Find user by ID
            { isActive: false }, // Update isActive to false (revoke access)
            { new: true, runValidators: true } // Options: return updated doc, run validators
        );

        if (!user) {
            return res.status(404).json({ message: 'User not found' }); // Handle case where user ID is invalid
        }

        // Exclude password from the response for security
        const userResponse = user.toObject();
        delete userResponse.password;

        res.json({ message: 'User access revoked successfully', user: userResponse }); // Respond with success and updated user data (without password)

    } catch (error) {
        if (error.name === 'CastError' && error.kind === 'ObjectId') {
            // Handle invalid ObjectId format in userId
            return res.status(400).json({ message: 'Invalid user ID format' });
        }
        res.status(500).json({ message: 'Failed to revoke user access', error: error.message }); // Handle other errors
    }
};

exports.postExtendUserValidity = async (req, res) => {
    const { userId } = req.params; // Extract userId from URL parameters
    const { validUntil } = req.body; // Extract validUntil date from request body

    try {
        const user = await User.findByIdAndUpdate(
            userId, // Find user by ID
            { validUntil: validUntil }, // Update validUntil field with the provided date
            { new: true, runValidators: true } // Options: return updated doc, run validators
        );

        if (!user) {
            return res.status(404).json({ message: 'User not found' }); // Handle case where user ID is invalid
        }

        // Exclude password from the response for security
        const userResponse = user.toObject();
        delete userResponse.password;

        res.json({ message: 'User validity extended successfully', user: userResponse }); // Respond with success and updated user data (without password)

    } catch (error) {
        if (error.name === 'CastError' && error.kind === 'ObjectId') {
            // Handle invalid ObjectId format in userId
            return res.status(400).json({ message: 'Invalid user ID format' });
        }
        res.status(400).json({ message: 'Failed to extend user validity', error: error.message }); // Respond with 400 for other validation errors or invalid date format
    }
};

exports.getCampaignListForReports = (req, res) => {
    const dummyCampaignList = [
        { id: 1, title: 'Medical Appeal for Student X' },
        { id: 2, title: 'Emergency Fund for Hostel Fire Victims' },
        { id: 3, title: 'Books and Supplies Drive' },
    ];
    res.json(dummyCampaignList);
};

exports.getGeneralContributionsReport = async (req, res) => {
    try {
        const { startDate, endDate, format } = req.query;
        console.log("Generating General Contributions Report...", { startDate, endDate, format });
        let filter = {};
        if (startDate && endDate) {
            filter.paymentDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }
        // Update populate: Remove trackingNumber
        const contributions = await Contribution.find(filter)
            .populate('contributor', 'fullName email admissionNumber')
            .populate('campaign', 'title'); // <-- REMOVED trackingNumber

        if (format === 'csv') {
            if (contributions.length === 0) return res.status(200).send("No contributions to report.");
            // Update csvFields: Remove campaign.trackingNumber
            const csvFields = ['paymentDate', 'amount', 'paymentMethod', 'status', 'contributor.fullName', 'contributor.email', 'contributor.admissionNumber', 'campaign.title']; // <-- REMOVED campaign.trackingNumber
            const csvOptions = { fields: csvFields };
            const csvData = parse(contributions, csvOptions);
            res.header('Content-Type', 'text/csv');
            res.attachment('general-contributions-report.csv');
            return res.send(csvData);
        } // ... rest of the function
        else {
            return res.status(400).json({ message: 'Invalid or unsupported report format requested.' });
        }
    } catch (error) {
        console.error("Error generating general contributions report:", error);
        res.status(500).json({ message: 'Error generating general contributions report', error: error.message });
    }
};

exports.getCampaignSpecificReport = async (req, res) => {
    try {
        const { campaignId, startDate, endDate, format } = req.query;
        console.log("Generating Campaign Specific Report...", { campaignId, startDate, endDate, format });
        if (!campaignId) return res.status(400).json({ message: 'Campaign ID is required.' });
        let filter = { campaign: campaignId };
        if (startDate && endDate) {
            filter.paymentDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }
        // Update populate: Remove trackingNumber
        const contributions = await Contribution.find(filter)
            .populate('contributor', 'fullName email admissionNumber')
            .populate('campaign', 'title'); // <-- REMOVED trackingNumber

        if (format === 'csv') {
            if (contributions.length === 0) return res.status(200).send("No contributions for this campaign to report.");
            // Update csvFields: Remove campaign.trackingNumber
            const csvFields = ['paymentDate', 'amount', 'paymentMethod', 'status', 'contributor.fullName', 'contributor.email', 'contributor.admissionNumber', 'campaign.title']; // <-- REMOVED campaign.trackingNumber
            const csvOptions = { fields: csvFields };
            const csvData = parse(contributions, csvOptions);
            res.header('Content-Type', 'text/csv');
            res.attachment(`campaign-${campaignId}-report.csv`);
            return res.send(csvData);
        } // ... rest of the function
        else {
            return res.status(400).json({ message: 'Invalid or unsupported report format requested.' });
        }
    } catch (error) {
        console.error("Error generating campaign-specific report:", error);
        res.status(500).json({ message: 'Error generating campaign-specific report', error: error.message });
    }
};

exports.getAdminProfile = async (req, res) => {
    try {
        // Access the authenticated user from req.user (set by authMiddleware)
        const adminUser = req.user;

        if (!adminUser) {
            return res.status(404).json({ message: 'Admin user not found in request context.' }); // Should not happen if authMiddleware is correctly set up
        }

        // Fetch the admin user's profile from the database using their ID
        const adminProfile = await User.findById(adminUser._id).select('-password'); // Exclude password for security

        if (!adminProfile) {
            return res.status(404).json({ message: 'Admin profile not found in database.' }); // Handle case where user might be deleted or corrupted
        }

        res.json(adminProfile); // Send the actual admin profile data

    } catch (error) {
        console.error("Error fetching admin profile:", error);
        res.status(500).json({ message: "Error fetching admin profile", error: error.message });
    }
};

exports.postChangePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user._id; // Admin changing their OWN password

    // Basic validation
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Current and new passwords are required.' });
    }

    // Add more robust validation for new password complexity if needed here
    if (newPassword.length < 8) {
        return res.status(400).json({ message: 'New password must be at least 8 characters long.' });
    }
    // You could add regex checks here too

    try {
        // Fetch admin user WITH password field
        const user = await User.findById(userId).select('+password'); // Use .select('+password') if excluded by default

        if (!user) {
            // This case should ideally not happen if authMiddleware is working
            return res.status(404).json({ message: 'Admin user not found.' });
        }

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Incorrect current password.' });
        }

        // Hash the new password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(newPassword, salt);

        // Save the updated user
        await user.save();

        res.json({ message: 'Admin password changed successfully.' });

    } catch (error) {
        console.error('Admin password change error:', error);
        res.status(500).json({ message: 'Failed to change password.', error: error.message });
    }
};

exports.postGrantUserAccess = async (req, res) => {
    const { userId } = req.params;
    try {
        const user = await User.findByIdAndUpdate(
            userId,
            { isActive: true },
            { new: true }
        );
        res.json({ message: 'User access granted', user });
    } catch (error) {
        res.status(500).json({ message: 'Failed to grant access', error: error.message });
    }
};

// --- REPLACE Existing postDisburseFunds ---
exports.initiateDisbursement = async (req, res) => {
    const { campaignId } = req.params;
    // Extract recipientPhone, amount, recipientName (optional), remarks (optional) from body
    const { recipientPhone, amount, recipientName, remarks } = req.body;
    const adminUserId = req.user._id; // Admin initiating the request

    console.log(`Initiating disbursement for Campaign ${campaignId}:`, { recipientPhone, amount, recipientName, remarks });

    // Basic Input Validation
    if (!recipientPhone || !amount) {
        return res.status(400).json({ message: 'Recipient phone number and amount are required.' });
    }
    if (isNaN(amount) || Number(amount) <= 0) {
        return res.status(400).json({ message: 'Invalid disbursement amount.' });
    }

    const session = await mongoose.startSession(); // Use transaction
    session.startTransaction();

    try {
        // 1. Find the campaign
        const campaign = await Campaign.findById(campaignId).session(session);

        if (!campaign) {
            await session.abortTransaction();
            session.endSession();
            return res.status(404).json({ message: 'Campaign not found.' });
        }

        // 2. Check Campaign Status and Funds
        // Allow disbursement from 'active' or 'ended' status? Let's allow 'ended' for now.
        if (campaign.status !== 'ended') {
            // You might adjust this logic if partial disbursements from 'active' are allowed
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: `Campaign must be in 'ended' state to disburse. Current state: ${campaign.status}` });
        }
        if (Number(amount) > campaign.currentAmount) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: `Disbursement amount (${amount}) exceeds available funds (${campaign.currentAmount}).` });
        }
        // Prevent re-disbursing if already completed or in progress
        if (['disbursing', 'disbursed'].includes(campaign.status) || campaign.disbursementStatus === 'processing' || campaign.disbursementStatus === 'completed') {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: `Campaign funds are already being processed or have been disbursed. Status: ${campaign.status}, Disbursement Status: ${campaign.disbursementStatus}` });
        }


        // 3. Initiate B2C Payment via Service
        console.log("Calling mpesaService.initiateB2CPayment...");
        const mpesaResult = await mpesaService.initiateB2CPayment(
            recipientPhone,
            amount,
            remarks || `Disbursement for ${campaign.title.substring(0, 50)}` // Use provided remarks or default
        );

        // mpesaResult should contain { success: true, ConversationID, OriginatorConversationID, ResponseDescription }
        console.log("Mpesa B2C Initiation Result:", mpesaResult);

        // 4. Update Campaign Record (if initiation accepted by M-Pesa)
        campaign.status = 'disbursing'; // Update main status
        campaign.disbursementStatus = 'processing'; // Track B2C status
        campaign.disbursementAmount = Number(amount);
        campaign.disbursementDate = new Date();
        campaign.disbursementMethod = 'M-Pesa B2C';
        campaign.disbursementRecipientPhone = recipientPhone;
        campaign.disbursementRecipientName = recipientName; // Store optional name
        campaign.disbursementDetails = remarks; // Store optional remarks
        campaign.disbursementInitiatedBy = adminUserId;
        // Store the ConversationID received from M-Pesa to link the callback
        campaign.disbursementTransactionID = mpesaResult.ConversationID;
        campaign.disbursementResultCode = null; // Clear previous results if any
        campaign.disbursementResultDesc = null;
        campaign.disbursementMpesaReceipt = null;


        // You *could* deduct the amount from currentAmount here, but it might be safer
        // to wait for the 'completed' callback to be absolutely sure. Let's wait.
        // campaign.currentAmount -= Number(amount); // Decide if you want to deduct now or on success callback

        await campaign.save({ session });

        // 5. Commit Transaction
        await session.commitTransaction();
        session.endSession();

        console.log(`Campaign ${campaignId} status updated to 'disbursing'. Waiting for M-Pesa callback.`);

        // 6. Respond to Admin Frontend
        res.status(200).json({
            message: 'Disbursement initiated successfully. Waiting for M-Pesa confirmation.',
            conversationId: mpesaResult.ConversationID, // Send back ID for reference
            campaignStatus: campaign.status,
            disbursementStatus: campaign.disbursementStatus
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error(`Error initiating disbursement for campaign ${campaignId}:`, error);
        res.status(500).json({
            message: 'Disbursement initiation failed.',
            // Send back a more specific error if it's from M-Pesa service
            error: error.message || 'Internal server error'
        });
    }
};
