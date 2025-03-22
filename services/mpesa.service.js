const axios = require('axios');
const bcrypt = require('bcryptjs');
const Contribution = require('../models/contribution.model');
const Campaign = require('../models/campaign.model');

const generateToken = async () => {
    const auth = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString('base64');
    const response = await axios.get('https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
        headers: { Authorization: `Basic ${auth}` }
    });
    return response.data.access_token;
};

exports.initiateSTKPush = async (phone, amount, campaignId, userId) => {
    const token = await generateToken();
    const timestamp = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 14);
    const password = Buffer.from(`${process.env.MPESA_BUSINESS_SHORT_CODE}${process.env.MPESA_PASSKEY}${timestamp}`).toString('base64');

    try {
        const response = await axios.post(
            'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
            {
                BusinessShortCode: process.env.MPESA_BUSINESS_SHORT_CODE,
                Password: password,
                Timestamp: timestamp,
                TransactionType: 'CustomerPayBillOnline',
                Amount: amount,
                PartyA: phone,
                PartyB: process.env.MPESA_BUSINESS_SHORT_CODE,
                PhoneNumber: phone,
                CallBackURL: `${process.env.BASE_URL}/api/mpesa-callback`,
                AccountReference: `CAMPAIGN-${campaignId}`,
                TransactionDesc: `Contribution to campaign ${campaignId}`
            },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        // Create contribution with transactionId
        const contribution = new Contribution({
            amount: Number(amount),
            campaign: campaignId,
            contributor: userId,
            paymentMethod: 'M-Pesa',
            status: 'pending',
            transactionId: response.data.CheckoutRequestID,
            mpesaCode: null // Explicitly set to null
        });

        await contribution.save();
        return response.data;

    } catch (error) {
        console.error('M-Pesa initiation error:', error);
        throw new Error('Payment initiation failed');
    }
};

exports.initiateB2CPayment = async (phone, amount, campaignId) => {
    const token = await generateToken();
    const response = await axios.post(
        'https://sandbox.safaricom.co.ke/mpesa/b2c/v1/paymentrequest',
        {
            InitiatorName: process.env.MPESA_B2C_INITIATOR_NAME,
            SecurityCredential: process.env.MPESA_B2C_SECURITY_CREDENTIAL,
            CommandID: 'BusinessPayment',
            Amount: amount,
            PartyA: process.env.MPESA_B2C_SHORTCODE,
            PartyB: phone,
            Remarks: `Campaign ${campaignId} disbursement`,
            QueueTimeOutURL: `${process.env.BASE_URL}/api/b2c-timeout`,
            ResultURL: `${process.env.BASE_URL}/api/b2c-result`,
            Occasion: 'CampaignDisbursement'
        },
        { headers: { Authorization: `Bearer ${token}` } }
    );

    return response.data;
};