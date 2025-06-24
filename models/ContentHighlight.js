const mongoose = require('mongoose');

const contentHighlightSchema = new mongoose.Schema({
    contentType: {
        type: String,
        enum: ['blog', 'thread', 'news', 'chronicle'],
        required: true
    },
    contentId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    highlightType: {
        type: String,
        enum: ['community', 'admin'],
        required: true
    },
    section: {
        type: String,
        enum: ['soul_scrolls', 'echoes_unbound', 'chronicles'],
        required: true
    },
    votesCount: {
        type: Number,
        default: 0
    },
    curatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    featuredDate: {
        type: Date,
        default: Date.now
    },
    active: {
        type: Boolean,
        default: true
    },
    adminNotes: {
        type: String,
        trim: true
    }
}, {
    timestamps: true
});

// Indexes for performance and uniqueness
contentHighlightSchema.index({ 
    contentType: 1, 
    contentId: 1, 
    highlightType: 1,
    section: 1 
}, { unique: true });

contentHighlightSchema.index({ section: 1, highlightType: 1, active: 1 });
contentHighlightSchema.index({ featuredDate: -1 });

const ContentHighlight = mongoose.model('ContentHighlight', contentHighlightSchema);
module.exports = ContentHighlight; 