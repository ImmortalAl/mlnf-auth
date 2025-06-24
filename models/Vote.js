const mongoose = require('mongoose');

const voteSchema = new mongoose.Schema({
    proposal: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Proposal',
        required: true
    },
    voter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    choice: {
        type: String,
        enum: ['approve', 'reject', 'abstain'],
        required: true
    },
    reasoning: {
        type: String,
        trim: true,
        maxlength: 500,
        default: null
    },
    weight: {
        type: Number,
        default: 1, // Future: could implement weighted voting
        min: 0,
        max: 10
    },
    isAnonymous: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Compound index to ensure one vote per user per proposal
voteSchema.index({ proposal: 1, voter: 1 }, { unique: true });

// Other indexes for performance
voteSchema.index({ proposal: 1, choice: 1 });
voteSchema.index({ voter: 1, createdAt: -1 });
voteSchema.index({ createdAt: -1 });

// Update timestamp on save
voteSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// Static method to get vote statistics for a proposal
voteSchema.statics.getProposalStats = async function(proposalId) {
    const stats = await this.aggregate([
        { $match: { proposal: proposalId } },
        {
            $group: {
                _id: '$choice',
                count: { $sum: 1 },
                totalWeight: { $sum: '$weight' }
            }
        }
    ]);

    const result = {
        approve: 0,
        reject: 0,
        abstain: 0,
        total: 0
    };

    stats.forEach(stat => {
        result[stat._id] = stat.count;
        result.total += stat.count;
    });

    return result;
};

// Static method to check if user has voted on proposal
voteSchema.statics.hasUserVoted = async function(proposalId, userId) {
    const vote = await this.findOne({ 
        proposal: proposalId, 
        voter: userId 
    });
    return vote ? vote.choice : null;
};

// Static method to get user's voting history
voteSchema.statics.getUserVotingHistory = async function(userId, limit = 20) {
    return await this.find({ voter: userId })
        .populate('proposal', 'title type status createdAt')
        .sort({ createdAt: -1 })
        .limit(limit);
};

module.exports = mongoose.model('Vote', voteSchema); 