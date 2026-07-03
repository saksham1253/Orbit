const mongoose = require("mongoose");

/**
 * Constellation — a co-op "Binary Star": two swap partners bound into a SHARED
 * streak (Orbit Engine, Tier 2). The shared streak advances only when BOTH
 * members take a real-progress action on the same UTC day, so breaking it lets
 * a person down — the strongest anti-churn mechanic. Additive: no existing
 * collection is touched.
 *
 * `members` is stored SORTED (by string id) so the unique index guarantees at
 * most one constellation per unordered pair. Per-member contribution days live
 * in `lastActionDay` (a plain object keyed by userId string). The pair gets its
 * own weekly Gravity Assist freeze, mirroring the personal streak's mercy model.
 */
const constellationSchema = new mongoose.Schema({
    members: {
        type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        validate: [(v) => v.length === 2, "A constellation must have exactly 2 members"],
        required: true,
    },
    // Sorted "idA_idB" — the unique key for the unordered pair. (A unique index
    // on the `members` ARRAY would instead cap each user to one constellation
    // ever, which is wrong; this scalar key enforces one-per-pair correctly.)
    pairKey:   { type: String, required: true },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type:      { type: String, default: "binary_star" },
    status:    { type: String, enum: ["pending", "active", "dissolved"], default: "pending" },

    // Shared streak state (UTC day / ISO week scoped, like the personal streak).
    streak: {
        current:       { type: Number, default: 0 },
        longest:       { type: Number, default: 0 },
        lastBothDay:   { type: String, default: null },   // "YYYY-MM-DD" both acted
        milestonesHit: { type: [Number], default: [] },
    },
    // Per-member last action day: { "<userId>": "YYYY-MM-DD" }. Mixed so we can
    // key by id without a fixed schema; marked modified on write.
    lastActionDay: { type: mongoose.Schema.Types.Mixed, default: {} },

    // Shared Gravity Assist — one free freeze per ISO week, auto-consumed to
    // bridge a day the pair missed together.
    freeze: {
        tokens:        { type: Number, default: 0 },
        lastGrantWeek: { type: String, default: "" },
    },

    activatedAt: { type: Date, default: null },
    dissolvedAt: { type: Date, default: null },
}, { timestamps: true });

// At most one constellation per unordered pair.
constellationSchema.index({ pairKey: 1 }, { unique: true });
// Fast "my constellations" lookups by status.
constellationSchema.index({ members: 1, status: 1 });

module.exports = mongoose.models.Constellation || mongoose.model("Constellation", constellationSchema);
