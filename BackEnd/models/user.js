const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },

    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },

    password: {
        type: String,
        required: true
    },

    bio: {
        type: String,
        default: "",
        trim: true
    },

    location: {
        type: String,
        default: "",
        trim: true
    },

    languages: {
        type: [String],
        default: ["English"]
    },

    // Geo coordinates (set via geocoding when user updates location)
    coordinates: {
        lat: { type: Number, default: null },
        lng: { type: Number, default: null }
    },

    // Trust Score System
    trustScore: {
        type: Number,
        default: 50,   // Everyone starts at 50/100
        min: 0,
        max: 100
    },

    totalRatings: {
        type: Number,
        default: 0
    },

    averageRating: {
        type: Number,
        default: 0
    },

    sentimentScore: {
        type: Number,
        default: 0 // Scale from -1.0 to 1.0 based on review sentiment
    },

    // Fraud Detection flags
    isFlagged: {
        type: Boolean,
        default: false
    },

    flagReason: {
        type: String,
        default: ""
    },

    // Activity tracking for fraud detection
    loginCount: {
        type: Number,
        default: 0
    },

    lastLogin: {
        type: Date,
        default: null
    },

    reportCount: {
        type: Number,
        default: 0
    },

    // Ethics & Safety: Dynamic Banning System
    warningCount: {
        type: Number,
        default: 0
    },
    banCount: {
        type: Number,
        default: 0
    },
    bannedUntil: {
        type: Date,
        default: null
    }

}, {
    timestamps: true
});

// Add Indexes for Scalability
userSchema.index({ trustScore: -1 });
userSchema.index({ bannedUntil: 1 });

module.exports = mongoose.models.User || mongoose.model("User", userSchema);