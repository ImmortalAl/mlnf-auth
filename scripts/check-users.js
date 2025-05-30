// Script to check all users and their roles
const mongoose = require('mongoose');
const User = require('../models/User');

// Use the same MongoDB URI as in app.js
const mongoUri = 'mongodb+srv://immortal:cN0VuntETXgV7xD1@mlnf-cluster.ctoehaf.mongodb.net/mlnf?retryWrites=true&w=majority';

async function checkUsers() {
    try {
        // Connect to MongoDB
        await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB');
        
        // Find all users
        const users = await User.find({}).select('username email role online createdAt');
        
        console.log(`\nTotal users: ${users.length}\n`);
        console.log('Username        | Email                    | Role      | Online | Created');
        console.log('----------------|--------------------------|-----------|--------|----------');
        
        users.forEach(user => {
            const username = (user.username || 'N/A').padEnd(15);
            const email = (user.email || 'N/A').padEnd(24);
            const role = (user.role || 'N/A').padEnd(9);
            const online = user.online ? 'Yes' : 'No ';
            const created = user.createdAt ? user.createdAt.toLocaleDateString() : 'N/A';
            console.log(`${username} | ${email} | ${role} | ${online}    | ${created}`);
        });
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.connection.close();
        console.log('\nDatabase connection closed');
    }
}

checkUsers(); 