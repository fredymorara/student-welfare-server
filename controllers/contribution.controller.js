const catchAsync = require('../utils/catchAsync');
const contributionService = require('../services/contribution.service');
const { validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');

exports.createContribution = catchAsync(async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const contribution = await contributionService.createContribution(req.body, req.user._id);
    res.status(201).json({ success: true, data: contribution });
});

exports.getAllContributions = catchAsync(async (req, res) => {
    const { page, limit, status, paymentMethod } = req.query;
    const data = await contributionService.getAllContributions(page, limit, status, paymentMethod);
    res.json({
        success: true,
        data: data.contributions,
        meta: {
            total: data.count,
            page: data.page,
            limit: data.limit,
            pages: data.pages
        }
    });
});

exports.getContributionById = catchAsync(async (req, res) => {
    const contribution = await contributionService.getContributionById(req.params.id);
    res.json({ success: true, data: contribution });
});

exports.updateContributionStatus = catchAsync(async (req, res) => {
    const contribution = await contributionService.updateContributionStatus(req.params.id, req.body.status);
    res.json({ success: true, data: contribution });
});

exports.getUserContributions = catchAsync(async (req, res) => {
    const contributions = await contributionService.getUserContributions(req.user._id);
    res.json({ success: true, data: contributions });
});

exports.getCampaignContributions = catchAsync(async (req, res) => {
    const contributions = await contributionService.getCampaignContributions(req.params.campaignId);
    res.json({ success: true, data: contributions });
});

exports.handlePaymentCallback = catchAsync(async (req, res) => {
    const callbackId = uuidv4();
    await contributionService.processPaymentCallback(req.body, callbackId);
    res.status(200).send();
});

exports.getContributionStatus = catchAsync(async (req, res) => {
    const status = await contributionService.checkContributionStatus(req.params.transactionId);
    res.json({ status });
});

exports.handleB2CResult = catchAsync(async (req, res) => {
    const response = await contributionService.processB2CResult(req.body);
    res.status(200).json(response);
});

exports.handleB2CTimeout = catchAsync(async (req, res) => {
    const response = await contributionService.processB2CTimeout(req.body);
    res.status(200).json(response);
});