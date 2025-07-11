const express = require('express');
const router = express.Router();
const authJWT = require('../middleware/authJWT.js.js');
const MindmapNode = require('../models/MindmapNode');
const MindmapEdge = require('../models/MindmapEdge');

// Fetch mindmap preview for front page (no auth required) 
router.get('/preview', async (req, res) => {
  try {
    // Get top 5 nodes by credibility score (once credibility is implemented)
    // For now, get the 5 most recent nodes
    const nodes = await MindmapNode.find()
      .populate('creator', 'username')
      .sort({ createdAt: -1 })
      .limit(5);
    
    // Get edges that connect these nodes
    const nodeIds = nodes.map(n => n._id);
    const edges = await MindmapEdge.find({
      sourceNode: { $in: nodeIds },
      targetNode: { $in: nodeIds }
    }).populate('creator', 'username');
    
    // Get stats
    const totalNodes = await MindmapNode.countDocuments();
    const totalEdges = await MindmapEdge.countDocuments();
    
    const previewData = {
      nodes: nodes.map(node => ({
        _id: node._id,
        title: node.title,
        content: node.content,
        credibility: { 
          score: node.credibility?.score || 50,
          votes: node.credibility?.votes || [],
          citations: node.credibility?.citations || []
        },
        creator: { username: node.creator?.username || 'Unknown' },
        tags: node.tags || [],
        position: node.position || { x: Math.random() * 400 + 100, y: Math.random() * 200 + 100 }
      })),
      edges: edges.map(edge => ({
        _id: edge._id,
        sourceNode: edge.sourceNode,
        targetNode: edge.targetNode,
        relationshipLabel: edge.relationshipLabel || 'connected to',
        creator: edge.creator?.username || 'Unknown'
      })),
      stats: {
        totalNodes,
        totalConnections: totalEdges,
        recentActivity: nodes.length > 0 ? `Latest: "${nodes[0].title}"` : 'No recent activity'
      }
    };
    
    res.json(previewData);
  } catch (error) {
    console.error('Fetch mindmap preview error:', error.message);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all nodes and edges for the mindmap
router.get('/', async (req, res) => {
  try {
    const nodes = await MindmapNode.find()
      .populate('creator', 'username')
      .populate('credibility.votes.user', 'username')
      .populate('credibility.citations.addedBy', 'username')
      .populate('editHistory.editedBy', 'username');
      
    const edges = await MindmapEdge.find()
      .populate('creator', 'username');
      
    res.json({ nodes, edges });
  } catch (err) {
    console.error('Error fetching mindmap:', err);
    res.status(500).json({ message: 'Error fetching mindmap data' });
  }
});

// Search nodes
router.get('/search', async (req, res) => {
  try {
    const { q, minCredibility, tags, creator } = req.query;
    
    const filters = {
      minCredibility: minCredibility ? parseInt(minCredibility) : undefined,
      tags: tags ? tags.split(',') : undefined,
      creator
    };
    
    const results = await MindmapNode.searchNodes(q, filters);
    
    res.json({
      query: q,
      results,
      count: results.length
    });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ message: 'Search failed' });
  }
});

// Get autocomplete suggestions for search
router.get('/search/suggestions', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) {
      return res.json({ titles: [], tags: [] });
    }
    
    const titleSuggestions = await MindmapNode.find({
      title: { $regex: q, $options: 'i' }
    }).limit(5).select('title');
    
    const tagSuggestions = await MindmapNode.distinct('tags', {
      tags: { $regex: q, $options: 'i' }
    });
    
    res.json({
      titles: titleSuggestions.map(n => n.title),
      tags: tagSuggestions.slice(0, 5)
    });
  } catch (err) {
    console.error('Suggestions error:', err);
    res.status(500).json({ message: 'Failed to get suggestions' });
  }
});

// Get label suggestions for connections
router.get('/labels/suggestions', authJWT.verifyToken, async (req, res) => {
  try {
    const { q } = req.query;
    const userId = req.userId;
    
    if (!q) {
      // Return most common labels if no query
      const commonLabels = await MindmapEdge.getUniqueLabels(userId);
      return res.json(commonLabels.map(l => l._id));
    }
    
    // Search for matching labels
    const matchingLabels = await MindmapEdge.searchLabels(q, userId);
    res.json(matchingLabels.map(l => l._id));
  } catch (err) {
    console.error('Label suggestions error:', err);
    res.status(500).json({ message: 'Failed to get label suggestions' });
  }
});

// Create a new node
router.post('/nodes', authJWT.verifyToken, async (req, res) => {
  try {
    const { title, content, position, tags } = req.body;
    
    const newNode = new MindmapNode({
      title,
      content,
      creator: req.userId,
      position: position || { x: 0, y: 0 },
      tags: tags || [],
      editHistory: [{
        editedBy: req.userId,
        changes: 'Node created'
      }]
    });
    
    const savedNode = await newNode.save();
    await savedNode.populate('creator', 'username');
    
    // Emit WebSocket event for real-time update
    if (req.app.locals.io) {
      req.app.locals.io.emit('nodeCreated', savedNode);
    }
    
    res.status(201).json(savedNode);
  } catch (err) {
    console.error('Create node error:', err);
    res.status(400).json({ message: err.message });
  }
});

// Update a node (any authenticated user can edit)
router.put('/nodes/:id', authJWT.verifyToken, async (req, res) => {
  try {
    const node = await MindmapNode.findById(req.params.id);
    if (!node) {
      return res.status(404).json({ message: 'Node not found' });
    }
    
    const { title, content, position, tags } = req.body;
    
    // Track what changed
    const changes = [];
    if (title && title !== node.title) {
      changes.push('Title updated');
      node.title = title;
    }
    if (content && content !== node.content) {
      changes.push('Content updated');
      node.content = content;
    }
    if (position) {
      node.position = position;
    }
    if (tags) {
      changes.push('Tags updated');
      node.tags = tags;
    }
    
    // Add to edit history
    if (changes.length > 0) {
      node.editHistory.push({
        editedBy: req.userId,
        changes: changes.join(', ')
      });
    }
    
    const updatedNode = await node.save();
    await updatedNode.populate('creator', 'username');
    await updatedNode.populate('editHistory.editedBy', 'username');
    
    // Emit WebSocket event
    if (req.app.locals.io) {
      req.app.locals.io.emit('nodeUpdated', updatedNode);
    }
    
    res.json(updatedNode);
  } catch (err) {
    console.error('Update node error:', err);
    res.status(400).json({ message: err.message });
  }
});

// Delete a node (only creator can delete)
router.delete('/nodes/:id', authJWT.verifyToken, async (req, res) => {
  try {
    const node = await MindmapNode.findById(req.params.id);
    if (!node) {
      return res.status(404).json({ message: 'Node not found' });
    }
    
    // Check if user is the creator
    if (node.creator.toString() !== req.userId) {
      return res.status(403).json({ message: 'Only the creator can delete this node' });
    }
    
    // Delete all edges connected to this node
    await MindmapEdge.deleteMany({
      $or: [
        { sourceNode: node._id },
        { targetNode: node._id }
      ]
    });
    
    // Delete the node
    await node.deleteOne();
    
    // Emit WebSocket event
    if (req.app.locals.io) {
      req.app.locals.io.emit('nodeDeleted', { nodeId: req.params.id });
    }
    
    res.json({ message: 'Node deleted successfully' });
  } catch (err) {
    console.error('Delete node error:', err);
    res.status(500).json({ message: 'Failed to delete node' });
  }
});

// Vote on a node
router.post('/nodes/:id/vote', authJWT.verifyToken, async (req, res) => {
  try {
    const { value } = req.body;
    if (value !== 1 && value !== -1) {
      return res.status(400).json({ message: 'Vote value must be 1 or -1' });
    }
    
    const node = await MindmapNode.findById(req.params.id);
    if (!node) {
      return res.status(404).json({ message: 'Node not found' });
    }
    
    // Remove any existing vote from this user
    node.credibility.votes = node.credibility.votes.filter(
      vote => vote.user.toString() !== req.userId
    );
    
    // Add the new vote
    node.credibility.votes.push({
      user: req.userId,
      value
    });
    
    // Save and recalculate credibility
    const updatedNode = await node.save();
    await updatedNode.populate('credibility.votes.user', 'username');
    
    // Emit WebSocket event
    if (req.app.locals.io) {
      req.app.locals.io.emit('nodeVoted', {
        nodeId: req.params.id,
        credibility: updatedNode.credibility
      });
    }
    
    res.json({
      credibility: updatedNode.credibility,
      message: `Vote ${value === 1 ? 'up' : 'down'} recorded`
    });
  } catch (err) {
    console.error('Vote error:', err);
    res.status(500).json({ message: 'Failed to record vote' });
  }
});

// Add a citation to a node
router.post('/nodes/:id/citations', authJWT.verifyToken, async (req, res) => {
  try {
    const { url, description } = req.body;
    
    const node = await MindmapNode.findById(req.params.id);
    if (!node) {
      return res.status(404).json({ message: 'Node not found' });
    }
    
    node.credibility.citations.push({
      url,
      description,
      addedBy: req.userId
    });
    
    const updatedNode = await node.save();
    await updatedNode.populate('credibility.citations.addedBy', 'username');
    
    // Emit WebSocket event
    if (req.app.locals.io) {
      req.app.locals.io.emit('citationAdded', {
        nodeId: req.params.id,
        credibility: updatedNode.credibility
      });
    }
    
    res.json({
      credibility: updatedNode.credibility,
      message: 'Citation added successfully'
    });
  } catch (err) {
    console.error('Add citation error:', err);
    res.status(400).json({ message: err.message });
  }
});

// Create an edge
router.post('/edges', authJWT.verifyToken, async (req, res) => {
  try {
    const { sourceNode, targetNode, relationshipLabel } = req.body;
    
    // Verify both nodes exist
    const [source, target] = await Promise.all([
      MindmapNode.findById(sourceNode),
      MindmapNode.findById(targetNode)
    ]);
    
    if (!source || !target) {
      return res.status(404).json({ message: 'Source or target node not found' });
    }
    
    // Check if edge already exists
    const existingEdge = await MindmapEdge.findOne({
      sourceNode,
      targetNode
    });
    
    if (existingEdge) {
      return res.status(400).json({ message: 'Edge already exists between these nodes' });
    }
    
    const newEdge = new MindmapEdge({
      sourceNode,
      targetNode,
      relationshipLabel,
      creator: req.userId
    });
    
    const savedEdge = await newEdge.save();
    await savedEdge.populate('creator', 'username');
    
    // Emit WebSocket event
    if (req.app.locals.io) {
      req.app.locals.io.emit('edgeCreated', savedEdge);
    }
    
    res.status(201).json(savedEdge);
  } catch (err) {
    console.error('Create edge error:', err);
    res.status(400).json({ message: err.message });
  }
});

// Update an edge (only relationship label can be updated)
router.put('/edges/:id', authJWT.verifyToken, async (req, res) => {
  try {
    const { relationshipLabel } = req.body;
    
    const edge = await MindmapEdge.findById(req.params.id);
    if (!edge) {
      return res.status(404).json({ message: 'Edge not found' });
    }
    
    edge.relationshipLabel = relationshipLabel;
    const updatedEdge = await edge.save();
    await updatedEdge.populate('creator', 'username');
    
    // Emit WebSocket event
    if (req.app.locals.io) {
      req.app.locals.io.emit('edgeUpdated', updatedEdge);
    }
    
    res.json(updatedEdge);
  } catch (err) {
    console.error('Update edge error:', err);
    res.status(400).json({ message: err.message });
  }
});

// Delete an edge (only creator can delete)
router.delete('/edges/:id', authJWT.verifyToken, async (req, res) => {
  try {
    const edge = await MindmapEdge.findById(req.params.id);
    if (!edge) {
      return res.status(404).json({ message: 'Edge not found' });
    }
    
    // Check if user is the creator
    if (edge.creator.toString() !== req.userId) {
      return res.status(403).json({ message: 'Only the creator can delete this edge' });
    }
    
    await edge.deleteOne();
    
    // Emit WebSocket event
    if (req.app.locals.io) {
      req.app.locals.io.emit('edgeDeleted', { edgeId: req.params.id });
    }
    
    res.json({ message: 'Edge deleted successfully' });
  } catch (err) {
    console.error('Delete edge error:', err);
    res.status(500).json({ message: 'Failed to delete edge' });
  }
});

module.exports = router;