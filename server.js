require('dotenv').config();
const cluster = require('cluster');
const os = require('os');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db.config');
const authRoutes = require('./routes/auth.routes');
const contributionController = require('./controllers/contribution.controller');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/error.middleware');

// Handle uncaught exceptions in the master process
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
    console.error(err.name, err.message, err.stack);
    process.exit(1);
});

const isClusterEnabled = process.env.ENABLE_CLUSTERING === 'true';
const numCPUs = os.cpus().length;

if (isClusterEnabled && (cluster.isMaster || cluster.isPrimary)) {
    logger.info(`Primary ${process.pid} is running`);
    logger.info(`Forking for ${numCPUs} CPUs...`);

    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
        logger.error(`Worker ${worker.process.pid} died. Forking a new one...`);
        cluster.fork();
    });
} else {
    const app = express();
    const port = process.env.PORT || 5000;

    // Trust Proxy for accurate IP tracking behind reverse proxies (Nginx/Load Balancers)
    app.set('trust proxy', 1);

    // Connect to MongoDB
    connectDB();

    // Global Security Middlewares
    app.use(helmet());
    app.use(cors());
    app.use(bodyParser.json({ limit: '10kb' }));
    app.use(mongoSanitize());

    // Rate Limiting Middlewares
    const globalLimiter = rateLimit({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 1000, // limit each IP to 1000 requests per windowMs
        message: 'Too many requests from this IP, please try again in an hour!'
    });
    app.use('/api', globalLimiter);

    const authLimiter = rateLimit({
        windowMs: 15 * 60 * 1000, // 15 mins
        max: 20, // Strict limit for auth routes
        message: 'Too many login attempts, please try again later!'
    });

    // Routes
    app.use('/auth', authLimiter, authRoutes);
    app.use('/member', require('./routes/member.routes'));
    app.use('/admin', require('./routes/admin.routes'));

    app.use('/api/mpesa-callback', (req, res, next) => {
        console.log('RAW CALLBACK RECEIVED:', {
            method: req.method,
            headers: req.headers,
            body: req.body,
            query: req.query
        });
        next();
    });

    app.post('/api/mpesa-callback', contributionController.handlePaymentCallback);
    app.post('/api/b2c-timeout', contributionController.handleB2CTimeout);
    app.post('/api/b2c-result', contributionController.handleB2CResult);
    app.get('/contributions/status/:transactionId', contributionController.getContributionStatus);

    // Handle unhandled routes
    app.all('*', (req, res, next) => {
        next(new (require('./utils/ApiError'))(404, `Can't find ${req.originalUrl} on this server!`));
    });

    // Global Error Handler Middleware
    app.use(errorHandler);

    // Start server
    const server = app.listen(port, () => {
        logger.info(`Worker ${process.pid} started and listening on port ${port}`);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err) => {
        console.error(`UNHANDLED REJECTION in Worker ${process.pid}! 💥 Shutting down...`);
        console.error(err.name, err.message, err.stack);
        server.close(() => {
            process.exit(1);
        });
    });
}