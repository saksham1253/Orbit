const mongoose = require("mongoose");

const ratingSchema = new mongoose.Schema({
    // Who gave the rating
    fromUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    // Who received the rating
    toUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    // Rating score 1-5
    score: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    // Optional review text
    review: {
        type: String,
        trim: true,
        default: ""
    },
    // What skill context was this for
    skillContext: {
        type: String,
        trim: true,
        default: ""
    },

    // ─────────────────────────────────────────────────────────────
    //  COSMIC LEADERBOARD (additive). The existing `score` (1-5 stars)
    //  above is the user's real rating and is NEVER modified by sentiment.
    //  Sentiment is precomputed off the request path by the sentiment worker
    //  and only nudges the CosmicScore; null means "not yet computed".
    // ─────────────────────────────────────────────────────────────
    sentiment: {
        score:      { type: Number, default: null },   // -1..+1 from BERT, null = uncomputed
        label:      { type: String, default: "" },     // "positive" | "neutral" | "negative"
        model:      { type: String, default: "" },     // model id/version for auditability
        computedAt: { type: Date,   default: null }
    },

    // Whether this review is tied to a completed swap (Connection.status==="completed").
    // Only completed-swap reviews count toward the CosmicScore (anti-gaming gate).
    tiedToCompletedSwap: { type: Boolean, default: false },

    // Admin moderation (spec I). A hidden review is withheld from public listings
    // (the star `score` still counts toward trust unless separately handled).
    // Reversible: restore clears these.
    hidden:    { type: Boolean, default: false },
    hiddenBy:  { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    hiddenAt:  { type: Date, default: null },
    hiddenReason: { type: String, default: "" }
}, {
    timestamps: true
});

// A user can only rate another user once
ratingSchema.index({ fromUser: 1, toUser: 1 }, { unique: true });

// Hot read path: ratings received by a user, newest first
// (getUserRatings / getMyTrustScore / recalculateTrustScore all filter on toUser)
ratingSchema.index({ toUser: 1, createdAt: -1 });

module.exports = mongoose.model("Rating", ratingSchema);
