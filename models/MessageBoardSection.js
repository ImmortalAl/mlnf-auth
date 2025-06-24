const mongoose = require('mongoose');

const messageBoardSectionSchema = new mongoose.Schema({
    sectionName: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    allowsAnonymous: {
        type: Boolean,
        default: false
    },
    allowsRegistered: {
        type: Boolean,
        default: true
    },
    category: {
        type: String,
        enum: ['Ideas', 'Debates', 'Trades', 'Events', 'Governance', 'Anonymous'],
        default: 'Ideas'
    },
    moderationLevel: {
        type: String,
        enum: ['none', 'post_publication', 'pre_publication'],
        default: 'post_publication'
    },
    requiresApproval: {
        type: Boolean,
        default: false
    },
    active: {
        type: Boolean,
        default: true
    },
    displayOrder: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Indexes
messageBoardSectionSchema.index({ active: 1, displayOrder: 1 });
messageBoardSectionSchema.index({ category: 1 });

const MessageBoardSection = mongoose.model('MessageBoardSection', messageBoardSectionSchema);
module.exports = MessageBoardSection; 