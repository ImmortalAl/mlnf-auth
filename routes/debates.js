const express = require('express');
const authMiddleware = require('../middleware/auth');
const Debate = require('../models/Debate');
const router = express.Router();

// Create debate
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description required' });
    }
    const debate = new Debate({
      title,
      description,
      creator: req.user.id
    });
    await debate.save();
    res.status(201).json({ message: 'Debate created', debate });
  } catch (error) {
    console.error('Error creating debate:', error);
    res.status(500).json({ error: 'Failed to create debate' });
  }
});

// Get all debates
router.get('/', async (req, res) => {
  try {
    const debates = await Debate.find().populate('creator', 'username displayName').sort({ createdAt: -1 });
    res.json(debates);
  } catch (error) {
    console.error('Error fetching debates:', error);
    res.status(500).json({ error: 'Failed to fetch debates' });
  }
});

// Vote on debate
router.post('/:id/vote', authMiddleware, async (req, res) => {
  try {
    const { vote } = req.body; // e.g., 'for', 'against'
    if (!['for', 'against'].includes(vote)) {
      return res.status(400).json({ error: 'Invalid vote' });
    }
    const debate = await Debate.findById(req.params.id);
    if (!debate) return res.status(404).json({ error: 'Debate not found' });
    debate.votes.push({ user: req.user.id, vote });
    await debate.save();
    res.json({ message: 'Vote recorded' });
  } catch (error) {
    console.error('Error voting:', error);
    res.status(500).json({ error: 'Failed to vote' });
  }
});

module.exports = router;