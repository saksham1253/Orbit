const mongoose = require("mongoose");

// ─────────────────────────────────────────────────────────────
//  Legend — the "Quasar" archive (Hall of Fame). At each season rollover,
//  the #1 mentor in every city is retired into a permanent named star
//  ("The Saksham Star") that survives all future resets.
//  Additive feature: no existing collection is touched.
// ─────────────────────────────────────────────────────────────
const legendSchema = new mongoose.Schema({
    userId:     { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    city:       { type: String, default: "" },
    seasonId:   { type: String, required: true },   // season they won
    starName:   { type: String, default: "" },      // "The Saksham Star"
    archivedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// One legend per (city, season) — guards against double rollover (idempotency).
legendSchema.index({ city: 1, seasonId: 1 }, { unique: true });
// Observatory reads a city's legends archive newest-first.
legendSchema.index({ city: 1, archivedAt: -1 });

module.exports = mongoose.models.Legend || mongoose.model("Legend", legendSchema);
