// seeder.js
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Campaign = require('./models/campaign.model');
const User = require('./models/user.model');
const Contribution = require('./models/contribution.model'); // Import Contribution model!
const connectDB = require('./config/db.config');

// Realistic Campaign Data
const realisticCampaignTitles = [
    "Emergency Medical Appeal for John Doe",
    "Student Tech Fund - Laptops for Needy Students",
    "Help Rebuild Hostel After Fire Incident",
    "Support Sarah's Tuition Fees - Fall Semester",
    "Disaster Relief - Food and Shelter for Flood Victims",
    "Mental Health Awareness Campaign on Campus",
    "Sports Equipment Drive for the University Teams",
    "Library Book Donation Drive - Expand Our Collection",
    "Support for Orphaned Children's Education",
    "Environmental Conservation Project - Tree Planting",
];

const realisticCampaignDescriptions = [
    "John Doe, a bright student, urgently needs medical surgery after a severe accident. Let's rally together to cover his medical expenses and support his recovery.",
    "Many bright students are held back by lack of access to technology. This fund aims to provide laptops to students who cannot afford them, enabling them to excel in their studies.",
    "A recent fire devastated one of our hostels, leaving many students without accommodation and basic necessities. Donate to help rebuild and support affected students.",
    "Sarah, a dedicated student, is at risk of dropping out due to financial difficulties in covering her tuition fees for the upcoming semester. Your contribution can keep her education dreams alive.",
    "Heavy floods have displaced hundreds in our community. This campaign aims to provide immediate relief in the form of food, clean water, and temporary shelter to the victims.",
    "Let's break the stigma around mental health and provide resources and support for students struggling with mental health challenges on campus.",
    "Our university sports teams are vital to campus life but lack adequate equipment. Help us equip our athletes to compete at their best and represent our university with pride.",
    "Our library's collection needs to grow to meet the evolving needs of our students. Donate to our book drive and help us expand our resources for learning and research.",
    "Let's extend our support beyond campus. This campaign aims to provide educational support and resources for orphaned children in our neighboring community.",
    "Join us in our environmental conservation efforts. We are launching a tree planting project to make our campus greener and contribute to a healthier environment.",
];

const realisticCampaignDetails = [
    "John Doe requires a complex surgery costing KES 750,000. Any amount you can contribute will make a significant difference in helping him get the treatment he needs.",
    "With KES 50,000, we can provide a refurbished laptop to a student in need. Our goal is to provide 50 laptops this semester. Help us reach more students.",
    "We urgently need funds to rebuild the hostel, provide temporary housing, and replace lost belongings for over 200 students. Your donation will directly impact their lives.",
    "Sarah needs KES 120,000 to cover her tuition for the Fall semester. Every contribution, big or small, will bring her closer to her goal and ensure she continues her studies.",
    "We are collecting donations to purchase food supplies, bottled water, blankets, and tents for flood victims. Distribution will be coordinated with local aid organizations.",
    "Funds raised will support workshops, counseling services, and awareness programs on campus to promote mental well-being and provide support for those in need.",
    "We need to raise KES 300,000 to purchase new sports equipment including uniforms, balls, and protective gear for various university teams.",
    "We are seeking donations of books across all disciplines, especially textbooks and academic journals. Donate your gently used books or contribute funds to purchase new ones.",
    "We aim to provide school supplies, uniforms, and pay school fees for 100 orphaned children for the upcoming academic year. Your support can change a child's future.",
    "Our project includes planting 1000 indigenous trees on campus and organizing workshops on environmental stewardship. Join us in making our university a model of sustainability.",
];


const categories = ['Medical', 'Academic', 'Emergency', 'Emergency', 'Medical', 'Other', 'Other', 'Other', 'Other', 'Other'];
// const statusOptions = ['active', 'active', 'active', 'pending_approval', 'ended', 'rejected']; // Removed varied statuses
const campaignsData = [];

for (let i = 0; i < 20; i++) { // Loop 20 times for 20 campaigns
    campaignsData.push({
        title: realisticCampaignTitles[i % realisticCampaignTitles.length], // Cycle through titles
        description: realisticCampaignDescriptions[i % realisticCampaignDescriptions.length], // Cycle through descriptions
        details: realisticCampaignDetails[i % realisticCampaignDetails.length], // Cycle through details
        category: categories[i % categories.length], // Cycle through categories
        goalAmount: Math.floor(Math.random() * 500000) + 100000,
        currentAmount: 0,
        endDate: new Date(
            2024,
            Math.floor(Math.random() * 12),
            Math.floor(Math.random() * 28 + 1)
        ),
        status: 'pending_approval', // Set status to pending_approval for all
        trackingNumber: `CMP-SEED-${(i + 1).toString().padStart(3, '0')}`, // Corrected tracking number sequence
    });
}


// Generate 10 Members + 1 Admin (Existing Users WITH History)
const usersData = [
    {
        admissionNumber: 'ADMIN001',
        fullName: 'Welfare Admin',
        email: 'admin@kabarak.ac.ke',
        password: 'adminpassword',
        role: 'admin',
        schoolFaculty: 'Admin Department',
        isVerified: true, // Add this line
        verificationToken: undefined, // Add this line
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
        isVerified: true, // Add this line
        verificationToken: undefined, // Add this line
    });
}

// Generate 3 New Members (Users WITHOUT History)
const newUsersData = [];
for (let i = 1; i <= 3; i++) {
    newUsersData.push({
        admissionNumber: `NEWUSER${i.toString().padStart(3, '0')}`,
        fullName: `New Student User ${i}`,
        email: `newuser${i}@kabarak.ac.ke`,
        password: 'newuserpassword',
        role: 'member',
        schoolFaculty: `Faculty of Arts and Humanities`, // Example faculty
        isVerified: true, // Add this line
        verificationToken: undefined, // Add this line
    });
}


const importData = async () => {
    try {
        await connectDB();
        await Campaign.deleteMany();
        await User.deleteMany();
        await Contribution.deleteMany(); // Make sure to clear contributions as well

        const insertedCampaigns = await Campaign.insertMany(campaignsData);

        // Hash and insert existing users WITH history and get their IDs
        const insertedUsersWithHistory = await Promise.all(usersData.map(async (user) => {
            const hashedPassword = await bcrypt.hash(user.password, 10);
            return { ...user, password: hashedPassword };
        }));
        const userDocsWithHistory = await User.insertMany(insertedUsersWithHistory);


        // Create contributions AFTER inserting users, so we have user IDs
        for (let userIndex = 0; userIndex < usersData.length; userIndex++) {
            if (usersData[userIndex].role === 'member') {
                const memberUser = userDocsWithHistory[userIndex]; // Get the inserted user document
                const contributionCount = Math.floor(Math.random() * 5) + 1;
                for (let i = 0; i < contributionCount; i++) {
                    const campaign = insertedCampaigns[Math.floor(Math.random() * insertedCampaigns.length)]; // Use insertedCampaigns.length
                    const amount = Math.floor(Math.random() * 15000) + 500;

                    const contribution = new Contribution({
                        amount,
                        campaign: campaign._id,
                        contributor: memberUser._id, // CORRECT: Set contributor ID here directly!
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
        }


        // Hash and insert NEW users WITHOUT history
        const hashedNewUsers = await Promise.all(newUsersData.map(async (newUser) => {
            const hashedPassword = await bcrypt.hash(newUser.password, 10);
            return { ...newUser, password: hashedPassword };
        }));
        await User.insertMany(hashedNewUsers);


        await Promise.all(insertedCampaigns.map(campaign => campaign.save()));


        console.log('Data Imported with Realistic Campaigns set to Pending Approval and New Users!');
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
        await Contribution.deleteMany(); // Also delete contributions when destroying data
        console.log('All Data Destroyed!');
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