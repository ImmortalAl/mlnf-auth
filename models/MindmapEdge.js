const mongoose = require('mongoose');

const mindmapEdgeSchema = new mongoose.Schema({
  sourceNode: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'MindmapNode', 
    required: true 
  },
  targetNode: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'MindmapNode', 
    required: true 
  },
  relationshipLabel: { 
    type: String, 
    required: true,
    maxLength: 100,
    trim: true
  },
  creator: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Index for efficient querying
mindmapEdgeSchema.index({ sourceNode: 1, targetNode: 1 });
mindmapEdgeSchema.index({ relationshipLabel: 1 });

// Static method to get all unique relationship labels for autocomplete
mindmapEdgeSchema.statics.getUniqueLabels = function(userId = null) {
  const pipeline = [];
  
  if (userId) {
    // Get labels used by specific user first
    pipeline.push(
      { $match: { creator: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: '$relationshipLabel', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 }
    );
  } else {
    // Get all labels sorted by frequency
    pipeline.push(
      { $group: { _id: '$relationshipLabel', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 50 }
    );
  }
  
  return this.aggregate(pipeline);
};

// Static method to search for labels (for autocomplete)
mindmapEdgeSchema.statics.searchLabels = function(query, userId = null) {
  const searchRegex = new RegExp(query, 'i');
  const matchStage = { $match: { relationshipLabel: searchRegex } };
  
  const pipeline = [matchStage];
  
  if (userId) {
    // Prioritize user's own labels
    pipeline.push(
      {
        $addFields: {
          isUserLabel: { $eq: ['$creator', new mongoose.Types.ObjectId(userId)] }
        }
      },
      { $group: { 
        _id: '$relationshipLabel', 
        count: { $sum: 1 },
        isUserLabel: { $max: '$isUserLabel' }
      }},
      { $sort: { isUserLabel: -1, count: -1 } },
      { $limit: 10 }
    );
  } else {
    pipeline.push(
      { $group: { _id: '$relationshipLabel', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    );
  }
  
  return this.aggregate(pipeline);
};

module.exports = mongoose.model('MindmapEdge', mindmapEdgeSchema);