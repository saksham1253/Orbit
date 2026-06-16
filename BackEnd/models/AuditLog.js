const mongoose = require("mongoose");

/**
 * AuditLog — append-only record of EVERY admin action (login attempts, views of
 * sensitive data, edits, role/status changes, deletions, overrides). This is
 * both a security control and an accountability ledger.
 *
 * APPEND-ONLY BY CONTRACT: no admin route or UI ever deletes from this
 * collection. There is intentionally no delete endpoint anywhere in the portal.
 */
const auditLogSchema = new mongoose.Schema({
    actorId:    { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, // null for failed/pre-auth attempts
    actorEmail: { type: String, default: "" },          // captured even when actorId is unknown
    action:     { type: String, required: true },       // e.g. "auth.login.success", "user.ban", "records.hardDelete"
    targetType: { type: String, default: "" },          // "user" | "rating" | "connection" | ...
    targetId:   { type: String, default: "" },
    reason:     { type: String, default: "" },
    before:     { type: mongoose.Schema.Types.Mixed, default: null }, // snapshot where feasible
    after:      { type: mongoose.Schema.Types.Mixed, default: null },
    ip:         { type: String, default: "" },
    userAgent:  { type: String, default: "" },
    success:    { type: Boolean, default: true }
}, { timestamps: { createdAt: true, updatedAt: false } });

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ actorId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

module.exports = mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);
