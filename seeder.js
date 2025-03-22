// seeder.js
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Campaign = require('./models/campaign.model');
const User = require('./models/user.model');
const connectDB = require('./config/db.config');

// Generate 20 Campaigns
const categories = ['Medical', 'Emergency', 'Academic', 'Emergency','Medical'];
const statusOptions = ['active', 'active', 'active'];
const campaignsData = [];

for (let i = 1; i <= 20; i++) {
    campaignsData.push({
        title: `Campaign ${i.toString().padStart(2, '0')} - ${categories[i % 5]}`,
        description: `Support for ${categories[i % 5]} initiative.`,
        details: `Detailed description for ${categories[i % 5]} campaign.`,
        category: categories[i % 5],
        goalAmount: Math.floor(Math.random() * 500000) + 100000,
        currentAmount: 0,
        endDate: new Date(
            2024,
            Math.floor(Math.random() * 12),
            Math.floor(Math.random() * 28 + 1)
        ),
        status: statusOptions[Math.floor(Math.random() * 3)],
        trackingNumber: `CMP-SEED-${i.toString().padStart(3, '0')}`,
    });
}

// Generate 10 Members + 1 Admin
const usersData = [
    {
        admissionNumber: 'ADMIN001',
        fullName: 'Welfare Admin',
        email: 'admin@kabarak.ac.ke',
        password: 'adminpassword',
        role: 'admin',
        schoolFaculty: 'Admin Department',
    },
];

for (let i = 1; i <= 10; i++) {
    usersData.push({
        admissionNumber: `MEMBER${i.toString().padStart(3, '0')}`,
        fullName: `Student Member ${i}`,
        email: `member${i}@kabarak.ac.ke`,
        password: 'memberpassword',
        role: 'member',
        schoolFaculty: `School of ${['Engineering', 'Medicine', 'Law', 'Business', 'Science'][i % 5]}`,
    });
}

const importData = async () => {
    try {
        await connectDB();
        await Campaign.deleteMany();
        await User.deleteMany();

        const insertedCampaigns = await Campaign.insertMany(campaignsData);

        const hashedUsers = await Promise.all(usersData.map(async (user) => {
            const hashedPassword = await bcrypt.hash(user.password, 10);
            const contributions = [];

            // Replace the contribution creation logic in seeder.js
            if (user.role === 'member') {
                const contributionCount = Math.floor(Math.random() * 5) + 1;
                for (let i = 0; i < contributionCount; i++) {
                    const campaign = insertedCampaigns[Math.floor(Math.random() * 20)];
                    const amount = Math.floor(Math.random() * 15000) + 500;

                    // Create Contribution document
                    const contribution = new Contribution({
                        amount,
                        campaign: campaign._id,
                        contributor: user._id, // Assuming user._id is available
                        paymentMethod: 'M-Pesa',
                        transactionId: `SEED-TXN-${campaign._id}-${Date.now()}-${i}`,
                        status: 'completed',
                        mpesaCode: `MPESA-${Date.now()}-${i}`
                    });
                    await contribution.save();

                    campaign.currentAmount += amount;
                    await campaign.save();
                }
            }

            return {
                ...user,
                password: hashedPassword,
                contributions
            };
        }));

        await Promise.all(insertedCampaigns.map(campaign => campaign.save()));
        await User.insertMany(hashedUsers);

        console.log('Data Imported!');
        process.exit();
    } catch (error) {
        console.error('Error with data import:', error);
        process.exit(1);
    }
};

const deleteData = async () => {
    try {
        await connectDB();
        await Campaign.deleteMany();
        await User.deleteMany();
        console.log('Data Destroyed!');
        process.exit();
    } catch (error) {
        console.error('Error with data destruction:', error);
        process.exit(1);
    }
};

if (process.argv[2] === '-import') {
    importData();
} else if (process.argv[2] === '-delete') {
    deleteData();
}