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

    // Avatar URL (Cloudinary, preset, or base64)
    avatar: {
        type: String,
        default: "" // Empty means use generated gradient avatar
    },

    socialLinks: {
        github: { type: String, default: "" },
        linkedin: { type: String, default: "" },
        website: { type: String, default: "" }
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
    },

    // Password Reset
    resetPasswordToken: { type: String },
    resetPasswordExpires: { type: Date },

    // Chat Enhancements
    lastSeen: {
        type: Date,
        default: Date.now
    },

    // ─────────────────────────────────────────────────────────────
    //  COSMIC LEADERBOARD (additive — see COSMIC_LEADERBOARD_IMPLEMENTATION_PLAN.md)
    //  NOTE: the legacy `coordinates {lat,lng}` field above is the existing
    //  source of truth for the Nearby map and is left UNTOUCHED. `geo.point`
    //  below is an ADDITIVE GeoJSON mirror used only for $geoNear leaderboard
    //  queries; it is backfilled from `coordinates` and never replaces it.
    // ─────────────────────────────────────────────────────────────

    // GeoJSON Point [lng, lat] for 2dsphere $geoNear (additive mirror of coordinates)
    geo: {
        point: {
            type: { type: String, enum: ["Point"] },          // undefined until set
            coordinates: { type: [Number] }                    // [lng, lat]
        }
    },

    // Administrative scope (reverse-geocoded; used for sparse-town fallback)
    city:    { type: String, default: "" },
    region:  { type: String, default: "" },
    country: { type: String, default: "" },
    cityCentroid: { type: [Number], default: undefined },      // snapped [lng, lat] for privacy

    // Cosmic ranking state (all additive; everyone defaults to Moon IV)
    cosmic: {
        score:      { type: Number, default: 0 },              // 0..100 CosmicScore
        tierId:     { type: String, default: "moon_4" },
        peakTierId: { type: String, default: "moon_4" },       // lifetime best, survives resets
        seasonId:   { type: String, default: "" },
        lastTierChangeAt: { type: Date, default: null },
        unlockedTitles:   { type: [String], default: [] },
        currentTitle:     { type: String, default: "" },
        flair:            { type: [String], default: [] },
        activeDaysThisSeason: { type: Number, default: 0 },
        weightedReviews:  { type: Number, default: 0 }         // for eligibility gates
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

// ── Cosmic Leaderboard indexes (additive) ──────────────────────────────────
// 2dsphere over the additive GeoJSON mirror powers $geoNear scope queries.
// Mongoose only indexes docs where geo.point exists, so users without a
// backfilled point are simply skipped — no impact on existing queries.
userSchema.index({ 'geo.point': '2dsphere' });
// Season-scoped ranking: fetch a city's pool ordered by CosmicScore.
userSchema.index({ 'cosmic.seasonId': 1, 'cosmic.score': -1 });

module.exports = mongoose.models.User || mongoose.model("User", userSchema);