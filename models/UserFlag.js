const mongoose = require('mongoose');

const userFlagSchema = new mongoose.Schema({
    reporterId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    flaggedUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    reason: {
        type: String,
        enum: [
            'spam',
            'harassment',
            'inappropriate_content',
            'trolling',
            'misinformation',
            'natural_law_violation',
            'other'
        ],
        required: true
    },
    description: {
        type: String,
        trim: true,
        maxlength: 1000
    },
    status: {
        type: String,
        enum: ['pending', 'under_review', 'resolved', 'dismissed'],
        default: 'pending'
    },
    relatedContent: {
        contentType: {
            type: String,
            enum: ['thread', 'comment', 'blog', 'message']
        },
        contentId: {
            type: mongoose.Schema.Types.ObjectId
        }
    },
    moderationCase: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ModerationCase'
    },
    adminNotes: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

// Prevent duplicate flags from same user for same flagged user
userFlagSchema.index({ reporterId: 1, flaggedUserId: 1, status: 1 });
userFlagSchema.index({ flaggedUserId: 1, status: 1 });
userFlagSchema.index({ status: 1 });

const UserFlag = mongoose.model('UserFlag', userFlagSchema);
module.exports = UserFlag; 