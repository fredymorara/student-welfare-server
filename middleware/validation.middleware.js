const { validationResult, body } = require('express-validator');

const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }
    next();
};

const authSchemas = {
    register: [
        body('fullName').trim().notEmpty().withMessage('Full name is required').escape(),
        body('admissionNumber').trim().notEmpty().withMessage('Admission number is required').escape(),
        body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
        body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
    ],
    login: [
        body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
        body('password').notEmpty().withMessage('Password is required'),
    ]
};

const memberSchemas = {
    updateProfile: [
        body('fullName').trim().notEmpty().withMessage('Full name is required').escape()
    ],
    changePassword: [
        body('currentPassword').notEmpty().withMessage('Current password is required'),
        body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters long')
    ],
    submitInquiry: [
        body('name').trim().notEmpty().withMessage('Name is required').escape(),
        body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
        body('subject').trim().notEmpty().withMessage('Subject is required').escape(),
        body('message').trim().notEmpty().withMessage('Message is required').escape()
    ],
    applyCampaign: [
        body('title').trim().notEmpty().withMessage('Title is required').escape(),
        body('description').trim().notEmpty().withMessage('Description is required').escape(),
        body('category').trim().notEmpty().withMessage('Category is required').escape(),
        body('goalAmount').isNumeric().withMessage('Goal amount must be a number'),
        body('endDate').isISO8601().withMessage('Valid end date is required').toDate()
    ]
};

const adminSchemas = {
    createCampaign: [
        body('title').trim().notEmpty().withMessage('Title is required').escape(),
        body('description').trim().notEmpty().withMessage('Description is required').escape(),
        body('category').trim().notEmpty().withMessage('Category is required').escape(),
        body('goalAmount').isNumeric().withMessage('Goal amount must be a number'),
        body('endDate').isISO8601().withMessage('Valid end date is required').toDate()
    ],
    rejectCampaign: [
        body('rejectionReason').trim().notEmpty().withMessage('Rejection reason is required').escape()
    ],
    initiateDisbursement: [
        body('amount').isNumeric().withMessage('Amount must be a number'),
        body('destinationAccount').trim().notEmpty().withMessage('Destination account is required').escape()
    ],
    createUser: [
        body('fullName').trim().notEmpty().withMessage('Full name is required').escape(),
        body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
        body('admissionNumber').trim().notEmpty().withMessage('Admission number is required').escape(),
        body('role').isIn(['member', 'admin']).withMessage('Invalid role'),
        body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
    ],
    extendValidity: [
        body('validUntil').isISO8601().withMessage('Valid date is required').toDate()
    ],
    changePassword: [
        body('currentPassword').notEmpty().withMessage('Current password is required'),
        body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters long')
    ]
};

module.exports = {
    validate,
    authSchemas,
    memberSchemas,
    adminSchemas
};
