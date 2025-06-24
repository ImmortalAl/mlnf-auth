const mongoose = require('mongoose');

const anonymousSubmissionSchema = new mongoose.Schema({
    content: {
        type: String,
        required: true,
        trim: true,
        maxlength: 5000
    },
    sectionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MessageBoardSection',
        required: true
    },
    displayName: {
        type: String,
        trim: true,
        maxlength: 50,
        default: 'Anonymous Seeker'
    },
    submissionFingerprint: {
        type: String,
        required: true
    },
    ipAddress: {
        type: String,
        required: true
    },
    userAgent: {
        type: String
    },
    status: {
        type: String,
        enum: ['published', 'flagged', 'removed', 'under_review'],
        default: 'published'
    },
    flags: [{
        reporterId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        reason: {
            type: String,
            enum: ['spam', 'inappropriate', 'off_topic', 'harmful'],
            required: true
        },
        timestamp: {
            type: Date,
            default: Date.now
        }
    }],
    moderationNotes: {
        type: String,
        trim: true
    },
    views: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Indexes for performance
anonymousSubmissionSchema.index({ sectionId: 1, status: 1, createdAt: -1 });
anonymousSubmissionSchema.index({ submissionFingerprint: 1 });
anonymousSubmissionSchema.index({ status: 1 });

const AnonymousSubmission = mongoose.model('AnonymousSubmission', anonymousSubmissionSchema);
module.exports = AnonymousSubmission; 