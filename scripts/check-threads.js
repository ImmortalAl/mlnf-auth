const mongoose = require('mongoose');
const Thread = require('../models/Thread');

async function checkThreads() {
    try {
        // Connect to MongoDB
        await mongoose.connect('mongodb://localhost:27017/mlnf', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB');

        // Get all threads
        const allThreads = await Thread.find({});
        console.log('\n=== ALL THREADS ===');
        console.log(`Total threads: ${allThreads.length}`);
        
        allThreads.forEach((thread, index) => {
            console.log(`${index + 1}. "${thread.title}" - Category: "${thread.category}"`);
        });

        // Group by category
        const byCategory = {};
        allThreads.forEach(thread => {
            if (!byCategory[thread.category]) {
                byCategory[thread.category] = [];
            }
            byCategory[thread.category].push(thread.title);
        });

        console.log('\n=== BY CATEGORY ===');
        Object.keys(byCategory).forEach(category => {
            console.log(`${category}: ${byCategory[category].length} threads`);
            byCategory[category].forEach(title => {
                console.log(`  - ${title}`);
            });
        });

        process.exit(0);

    } catch (error) {
        console.error('Error checking threads:', error);
        process.exit(1);
    }
}

checkThreads(); 