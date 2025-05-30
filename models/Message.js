const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() {
      return !this.isFeedback || !this.feedbackMetadata?.anonymous;
    }
  },
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  content: {
    type: String,
    required: true,
    trim: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  // Feedback-specific fields
  isFeedback: {
    type: Boolean,
    default: false,
  },
  feedbackMetadata: {
    anonymous: { type: Boolean, default: false },
    timestamp: { type: Date },
    userAgent: { type: String },
    ip: { type: String },
    senderInfo: {
      username: { type: String },
      displayName: { type: String },
      avatar: { type: String }
    }
  }
});

module.exports = mongoose.model('Message', messageSchema);