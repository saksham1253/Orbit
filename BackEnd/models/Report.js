const mongoose = require("mongoose");

/**
 * Report — a user-submitted report against another user, surfaced in the admin
 * Moderation queue. Additive: the existing `User.reportCount` counter is left
 * as-is; this model gives moderators the full context + a resolution workflow.
 */
const reportSchema = new mongoose.Schema({
    reporterId:   { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    reason:       { type: String, required: true },
    context:      { type: String, default: "" },         // free text / where it happened
    status:       { type: String, enum: ["open", "resolved", "dismissed"], default: "open", index: true },
    resolvedBy:   { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    resolvedAt:   { type: Date, default: null },
    adminNotes:   { type: String, default: "" }
}, { timestamps: true });

reportSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.models.Report || mongoose.model("Report", reportSchema);
