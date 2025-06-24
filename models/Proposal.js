const mongoose = require('mongoose');

const proposalSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        minlength: 5,
        maxlength: 150
    },
    description: {
        type: String,
        required: true,
        trim: true,
        minlength: 20
    },
    type: {
        type: String,
        required: true,
        enum: [
            'feature_request',
            'policy_change', 
            'moderation_decision',
            'content_guideline',
            'community_standard',
            'resource_allocation',
            'platform_improvement'
        ],
        default: 'feature_request'
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    threadId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Thread',
        required: true
    },
    status: {
        type: String,
        enum: [
            'draft',           // Being written/refined
            'discussion',      // Open for community discussion
            'voting',          // Active voting period
            'passed',          // Approved by community
            'failed',          // Rejected by community
            'implemented',     // Completed by admin
            'blocked',         // Cannot be implemented
            'expired'          // Voting period ended without resolution
        ],
        default: 'discussion'
    },
    votingStartDate: {
        type: Date,
        default: null
    },
    votingEndDate: {
        type: Date,
        default: null
    },
    votingPeriodDays: {
        type: Number,
        default: 7,
        min: 1,
        max: 30
    },
    passThreshold: {
        type: Number,
        default: 60, // 60% approval required
        min: 50,
        max: 90
    },
    minimumVotes: {
        type: Number,
        default: 5, // Minimum votes required for validity
        min: 1
    },
    implementation: {
        priority: {
            type: String,
            enum: ['low', 'medium', 'high', 'critical'],
            default: 'medium'
        },
        estimatedEffort: {
            type: String,
            enum: ['minimal', 'low', 'medium', 'high', 'extensive'],
            default: 'medium'
        },
        deadline: {
            type: Date,
            default: null
        },
        assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },
        progressNotes: [{
            note: String,
            author: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            timestamp: {
                type: Date,
                default: Date.now
            }
        }],
        completedAt: {
            type: Date,
            default: null
        }
    },
    votes: {
        approve: {
            type: Number,
            default: 0
        },
        reject: {
            type: Number,
            default: 0
        },
        abstain: {
            type: Number,
            default: 0
        }
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

// Indexes for performance
proposalSchema.index({ status: 1 });
proposalSchema.index({ type: 1 });
proposalSchema.index({ createdAt: -1 });
proposalSchema.index({ votingEndDate: 1 });

// Calculate approval percentage
proposalSchema.virtual('approvalPercentage').get(function() {
    const totalVotes = this.votes.approve + this.votes.reject;
    if (totalVotes === 0) return 0;
    return Math.round((this.votes.approve / totalVotes) * 100);
});

// Calculate total vote count
proposalSchema.virtual('totalVotes').get(function() {
    return this.votes.approve + this.votes.reject + this.votes.abstain;
});

// Check if proposal has passed
proposalSchema.virtual('hasPassed').get(function() {
    return this.totalVotes >= this.minimumVotes && 
           this.approvalPercentage >= this.passThreshold;
});

// Check if voting is active
proposalSchema.virtual('isVotingActive').get(function() {
    if (this.status !== 'voting') return false;
    const now = new Date();
    return now >= this.votingStartDate && now <= this.votingEndDate;
});

// Auto-update status based on voting results
proposalSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    
    // Auto-transition from voting to passed/failed
    if (this.status === 'voting' && !this.isVotingActive) {
        if (this.totalVotes >= this.minimumVotes) {
            this.status = this.hasPassed ? 'passed' : 'failed';
        } else {
            this.status = 'expired';
        }
    }
    
    next();
});

module.exports = mongoose.model('Proposal', proposalSchema); 