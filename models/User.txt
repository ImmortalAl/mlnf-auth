const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  displayName: { type: String },
  bio: { type: String },
  status: { type: String, default: 'Online' },
  avatar: { type: String, default: 'https://i.pravatar.cc/40' },
  joined: { type: Date, default: Date.now }
});

// Hash the password before saving
userSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  next();
});

const User = mongoose.model('User', userSchema);
module.exports = User;