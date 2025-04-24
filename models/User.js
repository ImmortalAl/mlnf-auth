const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3,
        maxlength: 30
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    displayName: {
        type: String,
        trim: true,
        maxlength: 50
    },
    avatar: {
        type: String,
        trim: true
    },
    status: {
        type: String,
        trim: true,
        maxlength: 100
    },
    bio: {
        type: String,
        trim: true,
        maxlength: 500
    },
    online: {
        type: Boolean,
        default: false
    },
    seed: {
        type: String
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('User', userSchema);