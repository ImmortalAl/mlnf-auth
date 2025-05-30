const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
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
  // Feedback system fields
  isFeedback: {
    type: Boolean,
    default: false,
  },
  anonymous: {
    type: Boolean,
    default: false,
  },
  feedbackMeta: {
    type: Object,
    default: {},
  },
});

module.exports = mongoose.model('Message', messageSchema);