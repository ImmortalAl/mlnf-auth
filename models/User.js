const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  displayName: String,
  bio: String,
  avatar: String,
  status: { type: String, default: 'offline' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);