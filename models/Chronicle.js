const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const chronicleSchema = new Schema({
    title: {
        type: String,
        required: [true, 'A title is required to chronicle an event.'],
        trim: true,
        maxlength: [200, 'A title must not exceed 200 characters.']
    },
    content: {
        type: String,
        required: [true, 'Content is required to describe the chronicle.']
    },
    author: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    eventDate: {
        type: Date,
        required: [true, 'The date when this event occurred is required.'],
        validate: {
            validator: function(value) {
                return value <= new Date();
            },
            message: 'Event date cannot be in the future.'
        }
    },
    sources: [{
        type: String,
        trim: true
    }],
    validations: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],
    challenges: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],
    comments: [{
        type: Schema.Types.ObjectId,
        ref: 'Comment'
    }]
}, {
    timestamps: true
});

chronicleSchema.virtual('validationCount').get(function() {
    return this.validations.length;
});

chronicleSchema.virtual('challengeCount').get(function() {
    return this.challenges.length;
});

chronicleSchema.virtual('commentCount').get(function() {
    return this.comments.length;
});

// Virtual to calculate time between event and revelation
chronicleSchema.virtual('revelationDelay').get(function() {
    const eventTime = new Date(this.eventDate).getTime();
    const revealTime = new Date(this.createdAt).getTime();
    const daysDiff = Math.floor((revealTime - eventTime) / (1000 * 60 * 60 * 24));
    
    if (daysDiff < 7) return `${daysDiff} days`;
    if (daysDiff < 30) return `${Math.floor(daysDiff / 7)} weeks`;
    if (daysDiff < 365) return `${Math.floor(daysDiff / 30)} months`;
    return `${Math.floor(daysDiff / 365)} years`;
});

module.exports = mongoose.model('Chronicle', chronicleSchema); 