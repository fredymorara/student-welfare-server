const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

const sendVerificationEmail = async (email, verificationToken) => {
    const verificationUrl = `${process.env.FRONTEND_URL}/auth/verify-email/${verificationToken}`;
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Verify Your Email Address - KABU Welfare System',
        html: `<p>Please verify your email address by clicking on the following link: <a href="${verificationUrl}">${verificationUrl}</a></p>`,
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        logger.info(`Verification email sent to ${email}: ${info.response}`);
        return true;
    } catch (error) {
        logger.error(`Email sending error for ${email}: ${error.message}`);
        // We throw an error so the service layer knows it failed if we care, but mostly it's operational.
        throw error;
    }
};

module.exports = {
    sendVerificationEmail
};
