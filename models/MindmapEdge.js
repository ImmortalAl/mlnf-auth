const mongoose = require('mongoose');

const mindmapEdgeSchema = new mongoose.Schema({
  sourceNode: { type: mongoose.Schema.Types.ObjectId, ref: 'MindmapNode', required: true },
  targetNode: { type: mongoose.Schema.Types.ObjectId, ref: 'MindmapNode', required: true },
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('MindmapEdge', mindmapEdgeSchema);