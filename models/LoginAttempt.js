const mongoose = require('mongoose');

const LoginAttemptSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true
    },
    ip: {
        type: String,
        required: true
    },
    success: {
        type: Boolean,
        required: true,
        default: false
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    reason: {
        type: String,
        enum: ['missing_credentials', 'user_not_found', 'incorrect_password', 'success'],
        required: true
    }
});

// Index for faster queries
LoginAttemptSchema.index({ timestamp: -1 });
LoginAttemptSchema.index({ success: 1, timestamp: -1 });

module.exports = mongoose.model('LoginAttempt', LoginAttemptSchema);