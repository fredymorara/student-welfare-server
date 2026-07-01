const User = require('../models/user.model');
const bcrypt = require('bcryptjs');
const ApiError = require('../utils/ApiError');

const getAllUsers = async (page = 1, limit = 10) => {
    const users = await User.find()
        .select('-password')
        .limit(limit * 1)
        .skip((page - 1) * limit)
        .sort({ createdAt: -1 });

    const count = await User.countDocuments();
    return {
        users,
        count,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(count / limit)
    };
};

const createUser = async (userData) => {
    const { admissionNumber, fullName, schoolFaculty, email, password, role } = userData;
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
        admissionNumber,
        fullName,
        schoolFaculty,
        email,
        password: hashedPassword,
        role,
    });

    const savedUser = await newUser.save();
    const userResponse = savedUser.toObject();
    delete userResponse.password;
    return userResponse;
};

const updateUserStatus = async (userId, isActive) => {
    const user = await User.findByIdAndUpdate(
        userId,
        { isActive },
        { new: true, runValidators: true }
    );
    if (!user) throw new ApiError(404, 'User not found');
    
    const userResponse = user.toObject();
    delete userResponse.password;
    return userResponse;
};

const extendUserValidity = async (userId, validUntil) => {
    const user = await User.findByIdAndUpdate(
        userId,
        { validUntil },
        { new: true, runValidators: true }
    );
    if (!user) throw new ApiError(404, 'User not found');
    
    const userResponse = user.toObject();
    delete userResponse.password;
    return userResponse;
};

const getAdminProfile = async (adminId) => {
    const adminProfile = await User.findById(adminId).select('-password');
    if (!adminProfile) throw new ApiError(404, 'Admin profile not found in database.');
    return adminProfile;
};

const changeAdminPassword = async (adminId, currentPassword, newPassword) => {
    if (!currentPassword || !newPassword) {
        throw new ApiError(400, 'Current and new passwords are required.');
    }
    if (newPassword.length < 8) {
        throw new ApiError(400, 'New password must be at least 8 characters long.');
    }

    const user = await User.findById(adminId).select('+password');
    if (!user) throw new ApiError(404, 'Admin user not found.');

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) throw new ApiError(400, 'Incorrect current password.');

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();
};

module.exports = {
    getAllUsers,
    createUser,
    updateUserStatus,
    extendUserValidity,
    getAdminProfile,
    changeAdminPassword
};
