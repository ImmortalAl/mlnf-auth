const mongoose = require('mongoose');
const Blog = require('../models/Blog');
const path = require('path');
// The .env file is in the 'back' folder, so we go up one level from 'scripts'
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const connectDB = async () => {
    try {
        if (!process.env.MONGO_URI) {
            throw new Error('MONGO_URI not found in .env file. The path is likely incorrect.');
        }
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('MongoDB Connected for Purge Script...');
    } catch (error) {
        console.error(`Error connecting to DB: ${error.message}`);
        process.exit(1);
    }
};

const purgeBlogs = async () => {
    await connectDB();
    try {
        console.log('Initiating The Great Scroll Purge...');
        const result = await Blog.deleteMany({});
        console.log(`Success! ${result.deletedCount} old scrolls have been purged from the kingdom.`);
        console.log('The realm is cleansed. A new era may begin.');
    } catch (error) {
        console.error('The Purge has failed, Your Majesty!');
        console.error(error);
    } finally {
        await mongoose.connection.close();
        console.log('Connection to the eternal database has been closed.');
        process.exit(0);
    }
};

purgeBlogs(); 