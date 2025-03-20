// controllers/admin.controller.js
const Campaign = require('../models/campaign.model'); // Import Campaign model
const User = require('../models/user.model'); // Import User model (for dashboard metrics - member count)
const bcrypt = require('bcryptjs'); // Import bcrypt for password hashing (install if you haven't
const { parse } = require('json2csv');
const Contribution = require('../models/contribution.model');

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

    // Log the entire request body to see what data is being received
    console.log("Request Body:", req.body); // <-- ADD THIS LOG

    try {
        const { title, description, details, category, goalAmount, endDate, trackingNumber } = req.body;

        const newCampaign = new Campaign({
            title,
            description,
            details,
            category,
            goalAmount,
            endDate,
            trackingNumber,
            // ... 
        });

        // Log the newCampaign object *before* saving to DB - to inspect the Mongoose document
        console.log("New Campaign Object (before save):", newCampaign); // <-- ADD THIS LOG

        const savedCampaign = await newCampaign.save();

        // Log the savedCampaign object after successful save - to confirm save
        console.log("Campaign saved successfully:", savedCampaign); // <-- ADD THIS LOG

        res.status(201).json({ message: 'Campaign created successfully', campaign: savedCampaign });
    } catch (error) {
        // Log the *full error object* to see the detailed error information
        console.error("Error in campaign creation:", error); // <-- Make sure you are logging the full 'error' object
        res.status(400).json({ message: 'Campaign creation failed', error: error.message });
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

exports.postDisburseFunds = async (req, res) => {
    const { campaignId } = req.params;
    // Extract disbursement details from request body (you'll need to send these from Postman in the request body when testing)
    const { disbursementMethod, disbursementDetails, disbursementAmount } = req.body;

    try {
        const campaign = await Campaign.findByIdAndUpdate(
            campaignId,
            {
                status: 'ended', // Update status to 'ended'
                disbursementDate: Date.now(), // Record disbursement date as now
                disbursementMethod: disbursementMethod, // Record disbursement method from request body
                disbursementDetails: disbursementDetails, // Record disbursement details from request body
                disbursementAmount: disbursementAmount, // Record disbursement amount from request body
                // disbursementInitiatedBy: req.user.id, // Ideally, get Admin user ID from authenticated request (we'll add authentication later)
                disbursementStatus: 'completed', // For now, assume disbursement is completed successfully 
            },
            { new: true, runValidators: true }
        );

        if (!campaign) {
            return res.status(404).json({ message: 'Campaign not found' });
        }

        // In a real application, you would also implement the actual fund disbursement process here
        // (e.g., integrate with payment gateway, trigger actual payment, handle transaction confirmations, etc.)
        console.log(`Funds disbursement recorded for campaign ID: ${campaignId}, Method: ${disbursementMethod}, Amount: ${disbursementAmount}`);

        // Exclude beneficiary and other sensitive fields from response if needed for security/privacy
        const campaignResponse = campaign.toObject();
        // delete campaignResponse.beneficiary; // Example: Exclude beneficiary info from response

        res.json({ message: 'Funds disbursement recorded successfully', campaign: campaignResponse });

    } catch (error) {
        if (error.name === 'CastError' && error.kind === 'ObjectId') {
            return res.status(400).json({ message: 'Invalid campaign ID format' });
        }
        res.status(400).json({ message: 'Failed to record funds disbursement', error: error.message }); // Use 400 for invalid request data
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

exports.getCampaignContributors = (req, res) => {
    const { campaignId } = req.params;
    const dummyContributors = [
        { memberName: 'Member One', amount: 1000, contributionDate: '2024-07-25' },
        { memberName: 'Another Member', amount: 500, contributionDate: '2024-07-26' },
    ];
    res.json(dummyContributors);
};

exports.getCampaignContributionHistory = (req, res) => {
    const { campaignId } = req.params;
    const dummyHistory = [
        { amount: 100, memberName: 'Member A', contributionDate: '2024-07-27', transactionId: 'TXN-001' },
        { amount: 200, memberName: 'Member B', contributionDate: '2024-07-28', transactionId: 'TXN-002' },
    ];
    res.json(dummyHistory);
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