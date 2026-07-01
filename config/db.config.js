// config/db.config.js
const mongoose = require('mongoose');

const connectDB = async (retries = 5, delay = 2000) => {
    while (retries > 0) {
        try {
            if (!process.env.MONGO_URI) {
                console.error('MongoDB Connection Error: MONGO_URI environment variable is missing.');
                process.exit(1);
            }
            await mongoose.connect(process.env.MONGO_URI);
            console.log('MongoDB Connected');
            return;
        } catch (error) {
            retries -= 1;
            console.error(`MongoDB Connection Error: ${error.message}. Retries left: ${retries}`);
            if (retries === 0) {
                console.error('MongoDB connection failed after maximum retries. Exiting.');
                process.exit(1);
            }
            await new Promise(res => setTimeout(res, delay));
            delay *= 2; // Exponential backoff
        }
    }
};

module.exports = connectDB;