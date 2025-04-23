const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  seed: {
    type: String,
    required: false,
    minlength: 8,
    maxlength: 100
  },
  displayName: {
    type: String,
    required: false,
    maxlength: 50
  },
  bio: {
    type: String,
    required: false,
    maxlength: 500
  },
  status: {
    type: String,
    required: false,
    maxlength: 100
  },
  avatar: {
    type: String,
    required: false,
    default: 'https://i.pravatar.cc/40' // Fallback avatar
  },
  online: {
    type: Boolean,
    default: false // Track online status
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', userSchema);