const mongoose = require('mongoose');

const proposalSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200
    },
    description: {
        type: String,
        required: true,
        trim: true,
        maxlength: 2000
    },
    type: {
        type: String,
        enum: ['operational', 'moderation', 'constitutional', 'content_curation'],
        required: true
    },
    submittedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    votingStart: {
        type: Date,
        default: Date.now
    },
    votingEnd: {
        type: Date,
        required: true
    },
    status: {
        type: String,
        enum: ['draft', 'active', 'passed', 'rejected', 'expired'],
        default: 'active'
    },
    implementationStatus: {
        type: String,
        enum: ['pending', 'in_progress', 'completed', 'failed'],
        default: 'pending'
    },
    yesVotes: {
        type: Number,
        default: 0
    },
    noVotes: {
        type: Number,
        default: 0
    },
    abstainVotes: {
        type: Number,
        default: 0
    },
    totalVotes: {
        type: Number,
        default: 0
    },
    requiredMajority: {
        type: Number,
        default: 0.5 // 50% majority
    },
    tags: [{
        type: String,
        trim: true
    }],
    discussionThreadId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Thread'
    }
}, {
    timestamps: true
});

// Index for performance
proposalSchema.index({ status: 1, votingEnd: 1 });
proposalSchema.index({ submittedBy: 1 });
proposalSchema.index({ type: 1 });

// Virtual to check if voting is still active
proposalSchema.virtual('isVotingActive').get(function() {
    return this.status === 'active' && new Date() <= this.votingEnd;
});

// Method to calculate vote percentages
proposalSchema.methods.getVotePercentages = function() {
    if (this.totalVotes === 0) {
        return { yes: 0, no: 0, abstain: 0 };
    }
    return {
        yes: (this.yesVotes / this.totalVotes * 100).toFixed(1),
        no: (this.noVotes / this.totalVotes * 100).toFixed(1),
        abstain: (this.abstainVotes / this.totalVotes * 100).toFixed(1)
    };
};

// Method to determine if proposal passed
proposalSchema.methods.hasPassed = function() {
    if (this.totalVotes === 0) return false;
    return (this.yesVotes / this.totalVotes) >= this.requiredMajority;
};

const Proposal = mongoose.model('Proposal', proposalSchema);
module.exports = Proposal; 