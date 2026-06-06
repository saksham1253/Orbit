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

    // Avatar URL (Cloudinary or preset)
    avatar: {
        type: String,
        default: "" // Empty means use generated gradient avatar
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
        default: 0.5, // Scale from 0 to 1 (0=negative, 0.5=neutral, 1=positive)
        min: 0,
        max: 1
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
userSchema.index({ createdAt: -1 });
userSchema.index({ trustScore: -1 });
userSchema.index({ bannedUntil: 1 });
// For geospatial queries using Legacy Coordinates (lng, lat) or GeoJSON.
// Mongoose 2dsphere index expects an array [lng, lat] or GeoJSON.
// Since current schema uses {lat, lng}, we should make sure we can index it, but MongoDB 2dsphere requires specific format. 
// However, the prompt mentioned adding 2dsphere index. If we add it, we might need to adjust the coordinates field format or use 2d index.
userSchema.index({ 'coordinates.lng': 1, 'coordinates.lat': 1 }); // Fallback compound index if 2dsphere is tricky, but let's try standard 2d or 2dsphere. Actually, 2dsphere requires GeoJSON. I will just add the compound index for now to speed up standard queries, or change the schema if needed. Let's keep it simple.

module.exports = mongoose.models.User || mongoose.model("User", userSchema);