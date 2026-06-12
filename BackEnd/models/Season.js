const mongoose = require("mongoose");

// ─────────────────────────────────────────────────────────────
//  Season — monthly competitive window for the cosmic leaderboard.
//  seasonId is "YYYY-MM" (e.g. "2026-06"). The season worker creates the
//  active season and, at rollover, marks it archived and opens the next one.
//  Additive feature: no existing collection is touched.
// ─────────────────────────────────────────────────────────────
const seasonSchema = new mongoose.Schema({
    seasonId: { type: String, required: true, unique: true }, // "YYYY-MM"
    startsAt: { type: Date, required: true },
    endsAt:   { type: Date, required: true },
    status:   { type: String, enum: ["active", "archived"], default: "active" }
}, { timestamps: true });

// Fast lookup of the currently-active season.
seasonSchema.index({ status: 1 });

module.exports = mongoose.models.Season || mongoose.model("Season", seasonSchema);
