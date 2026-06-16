const mongoose = require("mongoose");

/**
 * RankEvent — an append-only audit row for every cosmic rank-up / rank-down
 * MOMENT (Admin Command Center). One row is written server-side whenever a
 * user's resolved tier changes (wired into the existing moment-detection in
 * cosmicController.getMentorCosmic). Purely observability — it never feeds back
 * into scoring or the user-facing UI.
 */
const rankEventSchema = new mongoose.Schema({
    userId:      { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    scope:       { type: String, default: "global" },           // global | city | region | country
    fromTierId:  { type: String, required: true },
    toTierId:    { type: String, required: true },
    direction:   { type: String, enum: ["up", "down"], required: true },
    scoreBefore: { type: Number, default: null },
    scoreAfter:  { type: Number, default: null },
    trigger:     { type: String, default: "score" },            // score | review | swap | decay | season | admin
    seasonId:    { type: String, default: "" },
    city:        { type: String, default: "" }
}, { timestamps: { createdAt: true, updatedAt: false } });

// Hot query paths for the admin rank-event log.
rankEventSchema.index({ userId: 1, createdAt: -1 });
rankEventSchema.index({ direction: 1, createdAt: -1 });
rankEventSchema.index({ createdAt: -1 });

module.exports = mongoose.models.RankEvent || mongoose.model("RankEvent", rankEventSchema);
