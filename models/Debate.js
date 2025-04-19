const mongoose = require('mongoose');

const debateSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  votes: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    vote: { type: String, enum: ['for', 'against'] }
  }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Debate', debateSchema);