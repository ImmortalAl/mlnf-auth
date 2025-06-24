const mongoose = require('mongoose');

const moderationCaseSchema = new mongoose.Schema({
    flaggedUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    flags: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UserFlag'
    }],
    caseType: {
        type: String,
        enum: ['warning', 'temporary_restriction', 'deportation', 'appeal'],
        required: true
    },
    description: {
        type: String,
        required: true,
        trim: true,
        maxlength: 2000
    },
    status: {
        type: String,
        enum: ['pending_review', 'voting', 'decided', 'implemented', 'appealed'],
        default: 'pending_review'
    },
    votingStart: {
        type: Date
    },
    votingEnd: {
        type: Date
    },
    supportVotes: {
        type: Number,
        default: 0
    },
    opposeVotes: {
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
    decision: {
        type: String,
        enum: ['approved', 'rejected', 'pending']
    },
    implementedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    implementedAt: {
        type: Date
    },
    adminOverride: {
        used: {
            type: Boolean,
            default: false
        },
        reason: {
            type: String,
            trim: true
        },
        overriddenBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    }
}, {
    timestamps: true
});

// Indexes for performance
moderationCaseSchema.index({ flaggedUserId: 1 });
moderationCaseSchema.index({ status: 1 });
moderationCaseSchema.index({ votingEnd: 1 });

const ModerationCase = mongoose.model('ModerationCase', moderationCaseSchema);
module.exports = ModerationCase; 