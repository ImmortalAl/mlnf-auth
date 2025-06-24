const mongoose = require('mongoose');

const threadSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        minlength: 3,
        maxlength: 100
    },
    content: {
        type: String,
        required: true,
        trim: true,
        minlength: 10
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    category: {
        type: String,
        required: true,
        enum: ['Ideas', 'Debates', 'Trades', 'Events', 'Governance', 'Anonymous Whispers'],
        default: 'Ideas'
    },
    tags: {
        type: [String],
        default: []
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    replies: [{
        content: {
            type: String,
            required: true,
            trim: true,
            minlength: 1
        },
        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        createdAt: {
            type: Date,
            default: Date.now
        },
        isAnonymous: {
            type: Boolean,
            default: false
        },
        anonymousDisplayName: {
            type: String,
            trim: true,
            maxlength: 50,
            default: null
        }
    }],
    isLocked: {
        type: Boolean,
        default: false
    },
    isAnonymous: {
        type: Boolean,
        default: false
    },
    anonymousDisplayName: {
        type: String,
        trim: true,
        maxlength: 50,
        default: null
    }
});

module.exports = mongoose.model('Thread', threadSchema);