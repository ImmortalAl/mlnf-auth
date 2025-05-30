// Script to diagnose user documents structure
const mongoose = require('mongoose');
const User = require('../models/user');

// Use the same MongoDB URI as in app.js
const mongoUri = 'mongodb+srv://immortal:cN0VuntETXgV7xD1@mlnf-cluster.ctoehaf.mongodb.net/mlnf?retryWrites=true&w=majority';

async function diagnoseUsers() {
    try {
        // Connect to MongoDB
        await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB\n');
        
        // Get one user to check structure
        const sampleUser = await User.findOne({ username: 'ImmortalAl' });
        if (sampleUser) {
            console.log('Sample user (ImmortalAl) document structure:');
            console.log(JSON.stringify(sampleUser.toObject(), null, 2));
            console.log('\nRole field value:', sampleUser.role);
            console.log('Role field type:', typeof sampleUser.role);
        }
        
        // Try to directly update ImmortalAl using native MongoDB
        const db = mongoose.connection.db;
        const usersCollection = db.collection('users');
        
        console.log('\n--- Attempting direct MongoDB update ---');
        const directUpdate = await usersCollection.updateOne(
            { username: 'ImmortalAl' },
            { $set: { role: 'admin' } }
        );
        console.log('Direct update result:', directUpdate);
        
        // Check the result
        const updatedUser = await usersCollection.findOne({ username: 'ImmortalAl' });
        console.log('\nUpdated user role:', updatedUser?.role);
        
        // List all users with their role field
        console.log('\n--- All users with role field ---');
        const allUsers = await usersCollection.find({}).toArray();
        allUsers.forEach(user => {
            console.log(`${user.username}: role = ${user.role}`);
        });
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\nDatabase connection closed');
    }
}

diagnoseUsers(); 