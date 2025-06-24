const mongoose = require('mongoose');
const Thread = require('../models/Thread');
const User = require('../models/User');

async function createProductionThreads() {
    try {
        // Connect to production MongoDB
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/mlnf';
        await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to production MongoDB');

        // Find any existing user or create a system user
        let systemUser = await User.findOne({ username: 'SystemAdmin' });
        if (!systemUser) {
            systemUser = new User({
                username: 'SystemAdmin',
                email: 'system@mlnf.com',
                password: 'system_hash',
                displayName: 'MLNF System',
                role: 'admin'
            });
            await systemUser.save();
            console.log('Created system user');
        }

        // Delete any existing test threads
        await Thread.deleteMany({ 
            title: { 
                $regex: /^(Welcome to|Upcoming Community|The Great|Anonymous Thoughts|Trading Post|Governance Proposal)/ 
            } 
        });
        console.log('Cleared existing test threads');

        // Create test threads for each category
        const testThreads = [
            {
                title: 'Welcome to Ideas - Innovation Hub',
                content: '<p>🌟 Welcome to the Ideas section! This is where creative minds gather to share innovative concepts, breakthrough thoughts, and visionary proposals. What revolutionary idea will you contribute today?</p>',
                category: 'Ideas',
                tags: ['welcome', 'innovation', 'creativity'],
                author: systemUser._id
            },
            {
                title: 'Community Event - Virtual Democracy Workshop',
                content: '<p>🎉 Join us for an interactive workshop on Democracy 3.0! Learn how our constitutional direct democracy system works and participate in shaping our community\'s future. This event showcases our Events category.</p>',
                category: 'Events',
                tags: ['workshop', 'democracy', 'community'],
                author: systemUser._id
            },
            {
                title: 'The Great Philosophy Debate - Nature of Reality',
                content: '<p>🤔 Welcome to Debates! Let\'s engage in thoughtful discourse about the fundamental nature of reality. Are we living in a simulation? Is consciousness fundamental? Share your philosophical perspectives!</p>',
                category: 'Debates',
                tags: ['philosophy', 'reality', 'consciousness'],
                author: systemUser._id
            },
            {
                title: 'Anonymous Whispers - Secrets of the Soul',
                content: '<p>🎭 This is the Anonymous Whispers section, where you can share your deepest thoughts without revealing your identity. A space for vulnerability, honesty, and authentic expression.</p>',
                category: 'Anonymous Whispers',
                tags: ['anonymous', 'authentic', 'soul'],
                author: systemUser._id
            },
            {
                title: 'Trading Post - Exchange of Knowledge and Resources',
                content: '<p>🔄 Welcome to the Trades section! Here we exchange knowledge, resources, skills, and opportunities. What do you have to offer? What are you seeking? Let\'s build a gift economy!</p>',
                category: 'Trades',
                tags: ['exchange', 'knowledge', 'resources'],
                author: systemUser._id
            },
            {
                title: 'Governance Proposal - Community Charter v2.0',
                content: '<p>🏛️ This is the Governance section where we make collective decisions about our community. This sample proposal demonstrates how we can democratically evolve our community charter through transparent voting.</p>',
                category: 'Governance',
                tags: ['governance', 'charter', 'democracy'],
                author: systemUser._id
            }
        ];

        // Create threads with proper timestamps
        const createdThreads = [];
        for (const threadData of testThreads) {
            const thread = new Thread({
                ...threadData,
                createdAt: new Date(),
                updatedAt: new Date(),
                replies: [],
                isLocked: false
            });
            
            const saved = await thread.save();
            createdThreads.push(saved);
            console.log(`✅ Created: "${saved.title}" in ${saved.category}`);
        }

        // Verify creation
        console.log(`\n🎉 Successfully created ${createdThreads.length} test threads!`);
        
        // Count threads by category
        for (const category of ['Ideas', 'Events', 'Debates', 'Anonymous Whispers', 'Trades', 'Governance']) {
            const count = await Thread.countDocuments({ category });
            console.log(`📊 ${category}: ${count} threads`);
        }

        process.exit(0);

    } catch (error) {
        console.error('❌ Error creating production threads:', error);
        process.exit(1);
    }
}

// Only run if called directly
if (require.main === module) {
    createProductionThreads();
}

module.exports = createProductionThreads; 