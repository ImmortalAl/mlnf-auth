// Script to make a user an admin
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/user');

// Use the same MongoDB URI as in app.js
const mongoUri = 'mongodb+srv://immortal:cN0VuntETXgV7xD1@mlnf-cluster.ctoehaf.mongodb.net/mlnf?retryWrites=true&w=majority';

async function makeAdmin(username) {
    try {
        // Connect to MongoDB
        await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB');
        
        // Find user by username
        const user = await User.findOne({ username });
        
        if (!user) {
            console.error(`User "${username}" not found`);
            process.exit(1);
        }
        
        // Update role to admin
        user.role = 'admin';
        await user.save();
        
        console.log(`✅ Successfully updated ${username}'s role to admin`);
        console.log(`User details: ${user.username} (${user.email || 'no email'}) - Role: ${user.role}`);
        
        // Verify the update
        const updatedUser = await User.findOne({ username }).select('username role');
        console.log('Verification:', updatedUser);
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.connection.close();
        console.log('Database connection closed');
    }
}

// Get username from command line argument
const username = process.argv[2];

if (!username) {
    console.error('Please provide a username as argument');
    console.log('Usage: node make-admin.js <username>');
    process.exit(1);
}

makeAdmin(username); 