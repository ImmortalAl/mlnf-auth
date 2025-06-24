const mongoose = require('mongoose');
const MessageBoardSection = require('../models/MessageBoardSection');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://immortal:cN0VuntETXgV7xD1@mlnf-cluster.ctoehaf.mongodb.net/mlnf?retryWrites=true&w=majority', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('MongoDB connected for initialization');
    initializeSections();
}).catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
});

async function initializeSections() {
    console.log('🚀 Initializing Democracy 3.0 Message Board Sections...');

    const defaultSections = [
        {
            sectionName: 'Ideas',
            description: 'Share your innovative thoughts and concepts',
            allowsAnonymous: false,
            allowsRegistered: true,
            category: 'Ideas',
            displayOrder: 1
        },
        {
            sectionName: 'Debates',
            description: 'Engage in thoughtful discourse and debate',
            allowsAnonymous: false,
            allowsRegistered: true,
            category: 'Debates',
            displayOrder: 2
        },
        {
            sectionName: 'Trades',
            description: 'Exchange goods, services, and opportunities',
            allowsAnonymous: false,
            allowsRegistered: true,
            category: 'Trades',
            displayOrder: 3
        },
        {
            sectionName: 'Events',
            description: 'Coordinate gatherings and community events',
            allowsAnonymous: false,
            allowsRegistered: true,
            category: 'Events',
            displayOrder: 4
        },
        {
            sectionName: 'Governance',
            description: 'Democratic proposals and community decisions',
            allowsAnonymous: false,
            allowsRegistered: true,
            category: 'Governance',
            displayOrder: 5
        },
        {
            sectionName: 'Anonymous Whispers',
            description: 'Share thoughts without revealing your identity',
            allowsAnonymous: true,
            allowsRegistered: true,
            category: 'Anonymous',
            displayOrder: 6
        }
    ];

    try {
        // Clear existing sections (for fresh setup)
        console.log('🧹 Clearing existing sections...');
        await MessageBoardSection.deleteMany({});

        // Create new sections
        console.log('📝 Creating default sections...');
        for (const sectionData of defaultSections) {
            const section = new MessageBoardSection(sectionData);
            await section.save();
            console.log(`✅ Created section: ${sectionData.sectionName}`);
        }

        console.log('\n🎉 Democracy 3.0 initialization complete!');
        console.log('📊 Message Board Sections:');
        
        const sections = await MessageBoardSection.find().sort({ displayOrder: 1 });
        sections.forEach(section => {
            console.log(`   • ${section.sectionName} (${section.category})`);
            console.log(`     - Anonymous: ${section.allowsAnonymous ? '✓' : '✗'}`);
            console.log(`     - Registered: ${section.allowsRegistered ? '✓' : '✗'}`);
        });

        console.log('\n🚀 Ready to implement Democratic features!');
        
    } catch (error) {
        console.error('❌ Error initializing sections:', error);
    } finally {
        mongoose.connection.close();
        process.exit(0);
    }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
    console.log('Unhandled Rejection at:', promise, 'reason:', err);
    process.exit(1);
}); 