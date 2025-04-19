const express = require('express');
const authMiddleware = require('../middleware/auth');
const MindmapNode = require('../models/MindmapNode');
const MindmapEdge = require('../models/MindmapEdge');
const router = express.Router();

// Add node
router.post('/nodes', authMiddleware, async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content required' });
    }
    const node = new MindmapNode({
      title,
      content,
      creator: req.user.id
    });
    await node.save();
    res.status(201).json({ message: 'Node created', node });
  } catch (error) {
    console.error('Error creating node:', error);
    res.status(500).json({ error: 'Failed to create node' });
  }
});

// Get all nodes
router.get('/nodes', async (req, res) => {
  try {
    const nodes = await MindmapNode.find().populate('creator', 'username displayName');
    res.json(nodes);
  } catch (error) {
    console.error('Error fetching nodes:', error);
    res.status(500).json({ error: 'Failed to fetch nodes' });
  }
});

// Add edge
router.post('/edges', authMiddleware, async (req, res) => {
  try {
    const { sourceNode, targetNode } = req.body;
    if (!sourceNode || !targetNode) {
      return res.status(400).json({ error: 'Source and target nodes required' });
    }
    const edge = new MindmapEdge({
      sourceNode,
      targetNode,
      creator: req.user.id
    });
    await edge.save();
    res.status(201).json({ message: 'Edge created', edge });
  } catch (error) {
    console.error('Error creating edge:', error);
    res.status(500).json({ error: 'Failed to create edge' });
  }
});

// Get all edges
router.get('/edges', async (req, res) => {
  try {
    const edges = await MindmapEdge.find().populate('creator', 'username displayName');
    res.json(edges);
  } catch (error) {
    console.error('Error fetching edges:', error);
    res.status(500).json({ error: 'Failed to fetch edges' });
  }
});

module.exports = router;