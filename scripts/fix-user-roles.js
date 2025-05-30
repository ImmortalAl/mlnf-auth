// Script to fix user roles and make ImmortalAl an admin
const mongoose = require('mongoose');
const User = require('../models/user');

// Use the same MongoDB URI as in app.js
const mongoUri = 'mongodb+srv://immortal:cN0VuntETXgV7xD1@mlnf-cluster.ctoehaf.mongodb.net/mlnf?retryWrites=true&w=majority';

async function fixUserRoles() {
    try {
        // Connect to MongoDB
        await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB');
        
        // Update all users without a role to have 'user' role
        const updateResult = await User.updateMany(
            { $or: [{ role: null }, { role: { $exists: false } }] },
            { $set: { role: 'user' } }
        );
        console.log(`✅ Updated ${updateResult.modifiedCount} users to have 'user' role`);
        
        // Make ImmortalAl an admin
        const adminResult = await User.updateOne(
            { username: 'ImmortalAl' },
            { $set: { role: 'admin' } }
        );
        console.log(`✅ Updated ImmortalAl to admin: ${adminResult.modifiedCount > 0 ? 'Success' : 'Failed (user not found)'}`);
        
        // Show all users and their roles
        console.log('\nUpdated user list:');
        const users = await User.find({}).select('username role');
        users.forEach(user => {
            console.log(`  ${user.username}: ${user.role}`);
        });
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\nDatabase connection closed');
    }
}

fixUserRoles(); 