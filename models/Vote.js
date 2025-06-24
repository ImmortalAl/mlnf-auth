const mongoose = require('mongoose');

const voteSchema = new mongoose.Schema({
    proposalId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Proposal',
        required: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    choice: {
        type: String,
        enum: ['yes', 'no', 'abstain'],
        required: true
    },
    reasoning: {
        type: String,
        trim: true,
        maxlength: 500
    }
}, {
    timestamps: true
});

// Ensure one vote per user per proposal
voteSchema.index({ proposalId: 1, userId: 1 }, { unique: true });

// Index for performance
voteSchema.index({ proposalId: 1 });
voteSchema.index({ userId: 1 });

const Vote = mongoose.model('Vote', voteSchema);
module.exports = Vote; 