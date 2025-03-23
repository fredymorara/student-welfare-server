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
        // Destructure required fields
        const { title, description, category, goalAmount, endDate } = req.body;

        // Validate required fields
        if (!title || !description || !category || !goalAmount || !endDate) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        // Create campaign with admin user reference
        const newCampaign = new Campaign({
            title,
            description,
            category,
            goalAmount,
            endDate,
            createdBy: req.user._id, // Add admin user reference
            status: 'active' // Default status for admin-created campaigns
        });

        const savedCampaign = await newCampaign.save();

        res.status(201).json({
            message: 'Campaign created successfully',
            campaign: {
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

// Update admin.controller.js
exports.postDisburseFunds = async (req, res) => {
    const { campaignId } = req.params;
    const { phone, amount, ...disbursementDetails } = req.body;

    try {
        // Initiate B2C payment
        const result = await mpesaService.initiateB2CPayment(phone, amount, campaignId);

        // Update campaign record
        const campaign = await Campaign.findByIdAndUpdate(
            campaignId,
            {
                status: 'ended',
                disbursementDate: new Date(),
                disbursementStatus: 'processing',
                disbursementAmount: amount,
                ...disbursementDetails
            },
            { new: true }
        );

        res.json({ message: 'Disbursement initiated', transactionId: result.ConversationID, campaign });
    } catch (error) {
        res.status(500).json({ message: 'Disbursement failed', error: error.message });
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
            filter.paymentDate = {
                $gte: new Date(startDate),
                $lte: new Date(endDate),
            };
        }

        const contributions = await Contribution.find(filter)
            .populate('contributor', 'fullName email admissionNumber')
            .populate('campaign', 'title trackingNumber');

        if (format === 'csv') {
            if (contributions.length === 0) {
                return res.status(200).send("No contributions to report."); // Or handle empty report differently
            }
            const csvFields = ['paymentDate', 'amount', 'paymentMethod', 'status', 'contributor.fullName', 'contributor.email', 'contributor.admissionNumber', 'campaign.title', 'campaign.trackingNumber']; // Define fields for CSV
            const csvOptions = { fields: csvFields };
            const csvData = parse(contributions, csvOptions);

            res.header('Content-Type', 'text/csv');
            res.attachment('general-contributions-report.csv');
            return res.send(csvData);
        } else if (format === 'pdf') {
            // For PDF generation, you'd typically use a library like 'pdfmake' or 'html-pdf-node'
            // This is more complex and beyond the scope of this step. For now, just return JSON or CSV.
            return res.status(400).json({ message: 'PDF format not yet implemented for general report.' });
        } else {
            return res.status(400).json({ message: 'Invalid report format requested.' });
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

        if (!campaignId) {
            return res.status(400).json({ message: 'Campaign ID is required for campaign-specific report.' });
        }

        let filter = { campaign: campaignId }; // Filter by campaignId
        if (startDate && endDate) {
            filter.paymentDate = {
                $gte: new Date(startDate),
                $lte: new Date(endDate),
            };
        }

        const contributions = await Contribution.find(filter)
            .populate('contributor', 'fullName email admissionNumber')
            .populate('campaign', 'title trackingNumber');

        if (format === 'csv') {
            if (contributions.length === 0) {
                return res.status(200).send("No contributions for this campaign to report.");
            }
            const csvFields = ['paymentDate', 'amount', 'paymentMethod', 'status', 'contributor.fullName', 'contributor.email', 'contributor.admissionNumber', 'campaign.title', 'campaign.trackingNumber'];
            const csvOptions = { fields: csvFields };
            const csvData = parse(contributions, csvOptions);

            res.header('Content-Type', 'text/csv');
            res.attachment(`campaign-${campaignId}-report.csv`);
            return res.send(csvData);
        } else if (format === 'pdf') {
            return res.status(400).json({ message: 'PDF format not yet implemented for campaign-specific report.' });
        } else {
            return res.status(400).json({ message: 'Invalid report format requested.' });
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

exports.postChangePassword = (req, res) => {
    const { currentPassword, newPassword } = req.body;
    console.log('Admin password change request received');
    res.json({ message: 'Admin password changed successfully (dummy)' });
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