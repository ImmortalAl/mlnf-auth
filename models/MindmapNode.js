const mongoose = require('mongoose');

const mindmapNodeSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true,
    maxLength: 200,
    trim: true
  },
  content: { 
    type: String, 
    required: true,
    maxLength: 50000 // Generous limit for rich content
  },
  creator: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  position: {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 }
  },
  tags: [{
    type: String,
    maxLength: 50,
    trim: true
  }],
  credibility: {
    score: { 
      type: Number, 
      default: 50,
      min: 0,
      max: 100
    },
    votes: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      value: { type: Number, enum: [-1, 1] }, // -1 = downvote, 1 = upvote
      timestamp: { type: Date, default: Date.now }
    }],
    citations: [{
      url: { 
        type: String,
        validate: {
          validator: function(v) {
            return /^https?:\/\/.+/.test(v); // Basic URL validation
          },
          message: 'Must be a valid URL'
        }
      },
      description: { 
        type: String, 
        maxLength: 500,
        trim: true
      },
      addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      addedAt: { type: Date, default: Date.now }
    }]
  },
  editHistory: [{
    editedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    editedAt: { type: Date, default: Date.now },
    changes: { 
      type: String, 
      maxLength: 200,
      trim: true
    }
  }]
}, { 
  timestamps: true // Automatically adds createdAt and updatedAt
});

// Add text indexing for search functionality
mindmapNodeSchema.index({ 
  title: 'text', 
  content: 'text', 
  tags: 'text' 
});

// Method to calculate credibility score
mindmapNodeSchema.methods.calculateCredibilityScore = function() {
  const voteSum = this.credibility.votes.reduce((sum, vote) => sum + vote.value, 0);
  const citationWeight = this.credibility.citations.length * 5; // Each citation adds 5 points
  const baseScore = 50;
  
  // Calculate score: base + votes + citations, clamped between 0 and 100
  const calculatedScore = baseScore + voteSum + citationWeight;
  return Math.min(100, Math.max(0, calculatedScore));
};

// Update credibility score before saving
mindmapNodeSchema.pre('save', function(next) {
  if (this.isModified('credibility.votes') || this.isModified('credibility.citations')) {
    this.credibility.score = this.calculateCredibilityScore();
  }
  next();
});

// Static method for searching nodes
mindmapNodeSchema.statics.searchNodes = function(query, filters = {}) {
  const searchQuery = query ? { $text: { $search: query } } : {};
  
  // Add filters
  if (filters.minCredibility) {
    searchQuery['credibility.score'] = { $gte: filters.minCredibility };
  }
  
  if (filters.tags && filters.tags.length > 0) {
    searchQuery.tags = { $in: filters.tags };
  }
  
  if (filters.creator) {
    searchQuery.creator = filters.creator;
  }
  
  return this.find(searchQuery)
    .populate('creator', 'username')
    .sort(query ? { score: { $meta: 'textScore' } } : { createdAt: -1 });
};

module.exports = mongoose.model('MindmapNode', mindmapNodeSchema);