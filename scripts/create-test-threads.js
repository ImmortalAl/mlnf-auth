const mongoose = require('mongoose');
const Thread = require('../models/Thread');
const User = require('../models/User');

async function createTestThreads() {
    try {
        // Connect to MongoDB
        await mongoose.connect('mongodb://localhost:27017/mlnf', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB');

        // Find or create a test user
        let testUser = await User.findOne({ username: 'TestUser' });
        if (!testUser) {
            testUser = new User({
                username: 'TestUser',
                email: 'test@example.com',
                password: 'hashedpassword',
                displayName: 'Test User'
            });
            await testUser.save();
            console.log('Created test user');
        }

        // Create test threads in different categories
        const testThreads = [
            {
                title: 'Welcome to Ideas - Share Your Thoughts',
                content: '<p>This is a test thread in the Ideas category. What innovative concepts are you pondering?</p>',
                category: 'Ideas',
                tags: ['welcome', 'test'],
                author: testUser._id
            },
            {
                title: 'Upcoming Community Event - Virtual Gathering',
                content: '<p>Join us for a virtual gathering to discuss the future of our community. This is in the Events category.</p>',
                category: 'Events',
                tags: ['event', 'community'],
                author: testUser._id
            },
            {
                title: 'The Great Philosophy Debate',
                content: '<p>Let\'s debate the fundamental questions of existence. This thread is in the Debates category.</p>',
                category: 'Debates',
                tags: ['philosophy', 'debate'],
                author: testUser._id
            },
            {
                title: 'Anonymous Thoughts and Whispers',
                content: '<p>A place for anonymous sharing and reflection. This is in the Anonymous Whispers category.</p>',
                category: 'Anonymous Whispers',
                tags: ['anonymous', 'reflection'],
                author: testUser._id
            },
            {
                title: 'Trading Post - Books and Knowledge',
                content: '<p>Exchange books, knowledge, and resources here. This is in the Trades category.</p>',
                category: 'Trades',
                tags: ['trade', 'books'],
                author: testUser._id
            },
            {
                title: 'Governance Proposal - Community Guidelines',
                content: '<p>Let\'s discuss and vote on new community guidelines. This is in the Governance category.</p>',
                category: 'Governance',
                tags: ['governance', 'proposal'],
                author: testUser._id
            }
        ];

        // Check if threads already exist to avoid duplicates
        for (const threadData of testThreads) {
            const existingThread = await Thread.findOne({ 
                title: threadData.title,
                category: threadData.category 
            });
            
            if (!existingThread) {
                const thread = new Thread({
                    ...threadData,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    replies: [],
                    isLocked: false,
                    score: Math.floor(Math.random() * 10) // Random score for variety
                });
                
                await thread.save();
                console.log(`Created thread: ${thread.title} in ${thread.category}`);
            } else {
                console.log(`Thread already exists: ${threadData.title}`);
            }
        }

        console.log('Test threads creation completed!');
        process.exit(0);

    } catch (error) {
        console.error('Error creating test threads:', error);
        process.exit(1);
    }
}

createTestThreads(); 