const axios = require('axios');
const Contribution = require('../models/contribution.model');
const { v4: uuidv4 } = require('uuid');

const MpesaEndpoints = {
    sandbox: {
        oauth: 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
        stkPush: 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
        b2c: 'https://sandbox.safaricom.co.ke/mpesa/b2c/v1/paymentrequest',
    },
    production: {
        oauth: 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
        stkPush: 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
        b2c: 'https://api.safaricom.co.ke/mpesa/b2c/v1/paymentrequest',
    }
};

// Determine endpoint based on environment (simple example)
const environment = process.env.NODE_ENV === 'production' ? 'production' : 'sandbox';
const OAUTH_URL = MpesaEndpoints[environment].oauth;
const STKPUSH_URL = MpesaEndpoints[environment].stkPush;
const B2C_URL = MpesaEndpoints[environment].b2c;

const generateToken = async () => {
    // Use STK Push credentials for OAuth token as B2C often uses the same app
    const auth = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString('base64');
    try {
        const response = await axios.get(OAUTH_URL, {
            headers: { Authorization: `Basic ${auth}` }
        });
        console.log("M-Pesa OAuth Token generated successfully.");
        return response.data.access_token;
    } catch (error) {
        console.error('Error generating M-Pesa OAuth token:', error.response ? error.response.data : error.message);
        throw new Error('Failed to generate M-Pesa token');
    }
};

// --- STK Push Function (Keep as is) ---
exports.initiateSTKPush = async (phone, amount, campaignId, userId) => {
    const token = await generateToken();
    const timestamp = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 14);
    const password = Buffer.from(`${process.env.MPESA_BUSINESS_SHORT_CODE}${process.env.MPESA_PASSKEY}${timestamp}`).toString('base64');

    // Format phone number (basic example: remove leading + or 0, assume 254 prefix needed)
    let formattedPhone = phone.replace(/\s+/g, ''); // Remove spaces
    if (formattedPhone.startsWith('+')) {
        formattedPhone = formattedPhone.substring(1);
    } else if (formattedPhone.startsWith('0')) {
        formattedPhone = '254' + formattedPhone.substring(1);
    }
    // Add more robust validation if needed

    const payload = {
        BusinessShortCode: process.env.MPESA_BUSINESS_SHORT_CODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline', // Or 'CustomerBuyGoodsOnline' for Till
        Amount: Math.round(amount), // Ensure amount is an integer
        PartyA: formattedPhone, // Payer's phone number
        PartyB: process.env.MPESA_BUSINESS_SHORT_CODE, // Your Paybill or Till
        PhoneNumber: formattedPhone, // Payer's phone number again
        CallBackURL: `${process.env.BASE_URL}/api/mpesa-callback`, // Ensure BASE_URL is correct
        AccountReference: `CAMP-${campaignId.toString().slice(-10)}`, // Keep reference short
        TransactionDesc: `Welfare Contrib.` // Keep description short
    };

    console.log("Initiating STK Push with payload:", JSON.stringify(payload)); // Log sensitive data carefully

    try {
        const response = await axios.post(
            STKPUSH_URL,
            payload,
            { headers: { Authorization: `Bearer ${token}` } }
        );

        console.log('STK Push API Response:', response.data);

        if (response.data && response.data.ResponseCode === '0') {
            // Create contribution with transactionId
            const contribution = new Contribution({
                amount: Number(amount),
                campaign: campaignId,
                contributor: userId,
                paymentMethod: 'M-Pesa',
                status: 'pending', // Status is pending until callback confirms
                transactionId: response.data.CheckoutRequestID, // Safaricom's ID for this request
                mpesaCode: null
            });
            await contribution.save();
            console.log("Pending contribution record created:", contribution._id);
            return response.data; // Return the successful response data
        } else {
            // Handle non-zero response code from initial request
            console.error('STK Push Initiation Failed:', response.data);
            throw new Error(response.data.ResponseDescription || 'STK Push initiation failed');
        }


    } catch (error) {
        console.error('M-Pesa STK Push Axios Error:', error.response ? JSON.stringify(error.response.data) : error.message);
        // Extract specific M-Pesa error if available
        const errorMessage = error.response?.data?.errorMessage || error.message || 'Payment initiation failed';
        throw new Error(`STK Push Error: ${errorMessage}`);
    }
};

// --- B2C Payment Function (Updated) ---
exports.initiateB2CPayment = async (phone, amount, remarks = 'Campaign Disbursement', originatorConversationId = null) => {
    const token = await generateToken();

    // Format phone number (ensure it's in 254 format for B2C)
    let formattedPhone = phone.replace(/\s+/g, ''); // Remove spaces
    if (formattedPhone.startsWith('+')) {
        formattedPhone = formattedPhone.substring(1);
    } else if (formattedPhone.startsWith('0')) {
        formattedPhone = '254' + formattedPhone.substring(1);
    }
    // Basic validation
    if (!/^(254)\d{9}$/.test(formattedPhone)) {
        throw new Error('Invalid recipient phone number format. Use 254xxxxxxxxx.');
    }

    const payload = {
        // SecurityCredential: Use the one generated via Safaricom's instructions
        SecurityCredential: process.env.MPESA_B2C_SECURITY_CREDENTIAL,
        // InitiatorName: The API user granted B2C permissions
        InitiatorName: process.env.MPESA_B2C_INITIATOR_NAME,
        // CommandID: Defines the type of transaction
        CommandID: 'BusinessPayment', // Common type for sending to customer M-Pesa account
        // Amount: Amount to be sent
        Amount: Math.round(amount), // Ensure amount is an integer
        // PartyA: Your organization's B2C shortcode (sending funds FROM)
        PartyA: process.env.MPESA_B2C_SHORTCODE,
        // PartyB: Recipient's phone number (in 254xxxxxxxxx format)
        PartyB: formattedPhone,
        // Remarks: A short description for the transaction statement
        Remarks: remarks.substring(0, 100), // Keep remarks within limit
        // QueueTimeOutURL: URL M-Pesa calls if it cannot reach ResultURL
        QueueTimeOutURL: process.env.MPESA_B2C_TIMEOUT_URL, // From .env
        // ResultURL: URL M-Pesa calls with the final transaction status
        ResultURL: process.env.MPESA_B2C_RESULT_URL, // From .env
        // Occasion: Optional field
        Occasion: 'CampaignDisbursement',
        // OriginatorConversationID: Optional - your unique ID for the request (useful if you want to correlate)
        // If provided, M-Pesa includes it in the callback
        // OriginatorConversationID: originatorConversationId
    };

    console.log("Initiating B2C Payment with payload:", JSON.stringify(payload)); // Log sensitive data carefully

    try {
        const response = await axios.post(
            B2C_URL,
            payload,
            { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } } // Added Content-Type
        );

        console.log('B2C Initiation API Response:', response.data);

        // B2C initial response is just an acknowledgement (ResponseCode 0 means request accepted for processing)
        if (response.data && response.data.ResponseCode === '0') {
            console.log("B2C request accepted for processing. ConversationID:", response.data.ConversationID);
            // Return the key identifiers from the response
            return {
                success: true,
                ConversationID: response.data.ConversationID,
                OriginatorConversationID: response.data.OriginatorConversationID, // May be null if not sent
                ResponseDescription: response.data.ResponseDescription
            };
        } else {
            // Handle non-zero response code from initial request (meaning request itself failed)
            console.error('B2C Initiation Failed:', response.data);
            throw new Error(response.data.ResponseDescription || 'B2C request initiation failed');
        }

    } catch (error) {
        console.error('M-Pesa B2C Axios Error:', error.response ? JSON.stringify(error.response.data) : error.message);
        // Extract specific M-Pesa error if available
        const errorMessage = error.response?.data?.errorMessage || error.message || 'B2C payment initiation failed';
        throw new Error(`B2C Error: ${errorMessage}`);
    }
};

exports.checkTransactionStatus = async (checkoutRequestId) => {
    const token = await generateToken();
    const timestamp = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 14);
    const password = Buffer.from(`${process.env.MPESA_BUSINESS_SHORT_CODE}${process.env.MPESA_PASSKEY}${timestamp}`).toString('base64');

    const payload = {
        BusinessShortCode: process.env.MPESA_BUSINESS_SHORT_CODE,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId
    };

    console.log(`[MPESA][STATUS] Initiating status check for CheckoutRequestID: ${checkoutRequestId}`);
    console.debug('[MPESA][STATUS] Request payload:', payload);

    try {
        const apiUrl = environment === 'production'
            ? 'https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query'
            : 'https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query';

        const response = await axios.post(apiUrl, payload, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'X-Request-ID': uuidv4() // Add unique request ID
            }
        });

        console.log(`[MPESA][STATUS] Response for ${checkoutRequestId}:`, {
            code: response.data.ResultCode,
            description: response.data.ResultDesc
        });
        console.debug('[MPESA][STATUS] Full response:', response.data);

        return response.data;
    } catch (error) {
        console.error('[MPESA][STATUS] API Error:', {
            checkoutRequestId,
            error: error.response ? error.response.data : error.message,
            stack: error.stack
        });
        throw new Error('Failed to check transaction status');
    }
};