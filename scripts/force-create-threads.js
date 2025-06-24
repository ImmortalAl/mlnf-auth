const mongoose = require('mongoose');
const Thread = require('../models/Thread');
const User = require('../models/User');

async function forceCreateThreads() {
    try {
        // Connect to MongoDB
        await mongoose.connect('mongodb://localhost:27017/mlnf', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB');

        // Find any existing user or create a dummy one
        let testUser = await User.findOne();
        if (!testUser) {
            testUser = new User({
                username: 'TestUser',
                email: 'test@example.com',
                password: 'hashedpassword',
                displayName: 'Test User'
            });
            await testUser.save();
            console.log('Created test user');
        } else {
            console.log('Using existing user:', testUser.username);
        }

        // Delete any existing test threads first
        await Thread.deleteMany({ title: { $regex: /^(Welcome to Ideas|Upcoming Community Event|The Great Philosophy|Anonymous Thoughts|Trading Post|Governance Proposal)/ } });
        console.log('Cleared existing test threads');

        // Create new test threads
        const testThreads = [
            {
                title: 'Welcome to Ideas - Share Your Thoughts',
                content: '<p>This is a test thread in the Ideas category. What innovative concepts are you pondering?</p>',
                category: 'Ideas',
                tags: ['welcome', 'test'],
                author: testUser._id,
                createdAt: new Date(),
                updatedAt: new Date(),
                replies: [],
                isLocked: false
            },
            {
                title: 'Upcoming Community Event - Virtual Gathering',
                content: '<p>Join us for a virtual gathering to discuss the future of our community. This is in the Events category.</p>',
                category: 'Events',
                tags: ['event', 'community'],
                author: testUser._id,
                createdAt: new Date(),
                updatedAt: new Date(),
                replies: [],
                isLocked: false
            },
            {
                title: 'The Great Philosophy Debate',
                content: '<p>Let\'s debate the fundamental questions of existence. This thread is in the Debates category.</p>',
                category: 'Debates',
                tags: ['philosophy', 'debate'],
                author: testUser._id,
                createdAt: new Date(),
                updatedAt: new Date(),
                replies: [],
                isLocked: false
            },
            {
                title: 'Anonymous Thoughts and Whispers',
                content: '<p>A place for anonymous sharing and reflection. This is in the Anonymous Whispers category.</p>',
                category: 'Anonymous Whispers',
                tags: ['anonymous', 'reflection'],
                author: testUser._id,
                createdAt: new Date(),
                updatedAt: new Date(),
                replies: [],
                isLocked: false
            },
            {
                title: 'Trading Post - Books and Knowledge',
                content: '<p>Exchange books, knowledge, and resources here. This is in the Trades category.</p>',
                category: 'Trades',
                tags: ['trade', 'books'],
                author: testUser._id,
                createdAt: new Date(),
                updatedAt: new Date(),
                replies: [],
                isLocked: false
            },
            {
                title: 'Governance Proposal - Community Guidelines',
                content: '<p>Let\'s discuss and vote on new community guidelines. This is in the Governance category.</p>',
                category: 'Governance',
                tags: ['governance', 'proposal'],
                author: testUser._id,
                createdAt: new Date(),
                updatedAt: new Date(),
                replies: [],
                isLocked: false
            }
        ];

        // Insert all threads
        const createdThreads = await Thread.insertMany(testThreads);
        console.log(`Successfully created ${createdThreads.length} test threads!`);

        // Verify by counting threads per category
        for (const category of ['Ideas', 'Events', 'Debates', 'Anonymous Whispers', 'Trades', 'Governance']) {
            const count = await Thread.countDocuments({ category });
            console.log(`${category}: ${count} threads`);
        }

        process.exit(0);

    } catch (error) {
        console.error('Error creating test threads:', error);
        process.exit(1);
    }
}

forceCreateThreads(); 