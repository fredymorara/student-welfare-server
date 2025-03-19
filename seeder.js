// seeder.js
require('dotenv').config(); // Load environment variables
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Campaign = require('./models/campaign.model'); // Import Campaign model
const User = require('./models/user.model'); // Import User model
const connectDB = require('./config/db.config'); // Import database connection function

// Sample Campaign Data
const campaignsData = [
    {
        title: 'Medical Appeal for Student X',
        description: 'Help Student X cover urgent medical expenses.',
        details: 'Student X is facing a serious medical condition and needs financial assistance for treatment...',
        category: 'Medical',
        goalAmount: 200000,
        currentAmount: 10000,
        endDate: '2024-12-31',
        status: 'active',
        trackingNumber: 'CMP-SEED-001',
    },
    {
        title: 'Emergency Fund for Hostel Fire Victims',
        description: 'Support students affected by the recent hostel fire.',
        details: 'A recent fire in the student hostel has left many students without their belongings and in need of urgent support...',
        category: 'Emergency',
        goalAmount: 500000,
        currentAmount: 250000,
        endDate: '2024-11-15',
        status: 'active',
        trackingNumber: 'CMP-SEED-002',
    },
    {
        title: 'Laptop Fund for Needy Students',
        description: 'Help provide laptops to students who cannot afford them.',
        details: 'Many bright students lack access to laptops, hindering their studies. This campaign aims to bridge the digital divide...',
        category: 'Academic',
        goalAmount: 300000,
        currentAmount: 50000,
        endDate: '2024-10-31',
        status: 'pending_approval', // Example of a pending campaign
        trackingNumber: 'CMP-SEED-003',
    },
];

// Sample User Data (Admin and Member)
const usersData = [
    {
        admissionNumber: 'ADMIN001',
        fullName: 'Welfare Admin',
        email: 'admin@kabarak.ac.ke',
        password: 'adminpassword', // In real app, hash passwords!
        role: 'admin',
        schoolFaculty: 'Admin Department',
    },
    {
        admissionNumber: 'MEMBER001',
        fullName: 'Student Member One',
        email: 'member1@kabarak.ac.ke',
        password: 'memberpassword', // In real app, hash passwords!
        role: 'member',
        schoolFaculty: 'School of Engineering',
    },
    {
        admissionNumber: 'MEMBER002',
        fullName: 'Student Member Two',
        email: 'member2@kabarak.ac.ke',
        password: 'memberpassword', // In real app, hash passwords!
        role: 'member',
        schoolFaculty: 'School of Medicine',
    },
];

const importData = async () => {
    try {
        await connectDB(); // Connect to database
        await Campaign.deleteMany(); // Clear existing campaigns
        await User.deleteMany(); // Clear existing users

        // Hash passwords before inserting users
        const hashedUsersData = await Promise.all(usersData.map(async user => {
            const hashedPassword = await bcrypt.hash(user.password, 10);
            return { ...user, password: hashedPassword };
        }));

        await Campaign.insertMany(campaignsData); // Insert sample campaigns
        await User.insertMany(hashedUsersData); // Insert sample users (with hashed passwords)

        console.log('Data Imported!');
        process.exit(); // Exit the process after successful import
    } catch (error) {
        console.error('Error with data import:', error);
        process.exit(1); // Exit with error code
    }
};

const deleteData = async () => {
    try {
        await connectDB(); // Connect to database
        await Campaign.deleteMany(); // Delete all campaigns
        await User.deleteMany(); // Delete all users

        console.log('Data Destroyed!');
        process.exit(); // Exit after successful deletion
    } catch (error) {
        console.error('Error with data destruction:', error);
        process.exit(1); // Exit with error code
    }
};

if (process.argv[2] === '-import') {
    importData();
} else if (process.argv[2] === '-delete') {
    deleteData();
}