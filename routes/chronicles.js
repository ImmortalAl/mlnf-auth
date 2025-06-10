const express = require('express');
const router = express.Router();
const Chronicle = require('../models/Chronicle');
const auth = require('../middleware/auth');

// --- GET all chronicles (public, paginated) ---
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 15;
        const skip = (page - 1) * limit;

        const totalChronicles = await Chronicle.countDocuments();
        const totalPages = Math.ceil(totalChronicles / limit);

        const chronicles = await Chronicle.find()
            .populate('author', 'username displayName avatar')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.json({
            docs: chronicles,
            totalDocs: totalChronicles,
            totalPages: totalPages,
            page: page,
            limit: limit
        });
    } catch (error) {
        console.error('Error fetching chronicles:', error);
        res.status(500).json({ error: 'Failed to fetch chronicles' });
    }
});

// --- GET a single chronicle by ID (public) ---
router.get('/:id', async (req, res) => {
    try {
        const chronicle = await Chronicle.findById(req.params.id)
            .populate('author', 'username displayName avatar')
            .populate('comments'); // Future: Add comment population

        if (!chronicle) {
            return res.status(404).json({ error: 'Chronicle not found' });
        }
        res.json(chronicle);
    } catch (error) {
        console.error('Error fetching chronicle:', error);
        if (error.kind === 'ObjectId') {
            return res.status(404).json({ error: 'Invalid chronicle ID' });
        }
        res.status(500).json({ error: 'Failed to fetch chronicle' });
    }
});

// --- POST a new chronicle (protected) ---
router.post('/', auth, async (req, res) => {
    const { title, content, sources, eventDate } = req.body;

    if (!title || !content || !eventDate) {
        return res.status(400).json({ error: 'Title, content, and event date are required.' });
    }

    try {
        // sources can be a string separated by newlines
        const sourcesArray = sources ? sources.split('\n').map(s => s.trim()).filter(s => s) : [];

        const chronicle = new Chronicle({
            title,
            content,
            sources: sourcesArray,
            author: req.user.id,
            eventDate
        });

        await chronicle.save();
        const populatedChronicle = await Chronicle.findById(chronicle._id).populate('author', 'username displayName avatar');
        res.status(201).json(populatedChronicle);
    } catch (error) {
        console.error('Error creating chronicle:', error);
        // Provide more specific validation error messages
        if (error.name === 'ValidationError') {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to create chronicle' });
    }
});

// --- POST to validate a chronicle (protected) ---
router.post('/:id/validate', auth, async (req, res) => {
    try {
        const chronicle = await Chronicle.findById(req.params.id);
        if (!chronicle) {
            return res.status(404).json({ error: 'Chronicle not found' });
        }

        const userId = req.user.id;
        
        // Remove from challenges if present
        chronicle.challenges = chronicle.challenges.filter(id => id.toString() !== userId);
        
        // Toggle validation
        const validationIndex = chronicle.validations.findIndex(id => id.toString() === userId);
        if (validationIndex > -1) {
            chronicle.validations.splice(validationIndex, 1); // Already validated, remove
        } else {
            chronicle.validations.push(userId); // Not validated, add
        }
        
        await chronicle.save();
        
        res.json({
            validations: chronicle.validations.length,
            challenges: chronicle.challenges.length,
            userValidated: chronicle.validations.some(id => id.toString() === userId),
            userChallenged: false
        });
    } catch (error) {
        console.error('Error validating chronicle:', error);
        res.status(500).json({ error: 'Failed to validate chronicle' });
    }
});

// --- POST to challenge a chronicle (protected) ---
router.post('/:id/challenge', auth, async (req, res) => {
    try {
        const chronicle = await Chronicle.findById(req.params.id);
        if (!chronicle) {
            return res.status(404).json({ error: 'Chronicle not found' });
        }

        const userId = req.user.id;
        
        // Remove from validations if present
        chronicle.validations = chronicle.validations.filter(id => id.toString() !== userId);
        
        // Toggle challenge
        const challengeIndex = chronicle.challenges.findIndex(id => id.toString() === userId);
        if (challengeIndex > -1) {
            chronicle.challenges.splice(challengeIndex, 1); // Already challenged, remove
        } else {
            chronicle.challenges.push(userId); // Not challenged, add
        }
        
        await chronicle.save();
        
        res.json({
            validations: chronicle.validations.length,
            challenges: chronicle.challenges.length,
            userValidated: false,
            userChallenged: chronicle.challenges.some(id => id.toString() === userId)
        });
    } catch (error) {
        console.error('Error challenging chronicle:', error);
        res.status(500).json({ error: 'Failed to challenge chronicle' });
    }
});


module.exports = router;
