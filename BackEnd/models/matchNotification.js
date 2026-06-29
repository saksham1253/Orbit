const mongoose = require("mongoose");

/**
 * MatchNotification — de-dupe bookkeeping for perfect-match announcements (v7 §3).
 *
 * One row per user-pair + SKILL-pair, so a reciprocal "perfect match" on a given
 * pair of skills is announced to both people exactly once — re-posting the same
 * pair never re-spams — yet a genuinely DIFFERENT reciprocal pair between the
 * same two users (e.g. they also match on Guitar↔Piano) still announces. The
 * skill component is order-independent (the unordered {offered,wanted} set), so
 * both sides of the same reciprocal match collapse to one key. This is purely
 * notification state; it never touches cosmic standing or any user record.
 */
const matchNotificationSchema = new mongoose.Schema({
    pairKey: {
        type: String,
        required: true,
        unique: true
    }
}, { timestamps: true });

/**
 * Canonical, order-independent key for a perfect-match announcement.
 * Always symmetric in BOTH the user ids and the skill pair, so the two sides of
 * the same reciprocal match produce one key. Skills are optional for backward
 * compatibility (omitting them reproduces the old user-pair-only key).
 */
matchNotificationSchema.statics.keyFor = function (a, b, skillX, skillY) {
    const users = [String(a), String(b)].sort().join("__");
    if (skillX == null && skillY == null) return users;
    const norm = (s) => String(s || "").trim().toLowerCase();
    const skills = [norm(skillX), norm(skillY)].sort().join("|");
    return `${users}::${skills}`;
};

module.exports = mongoose.model("MatchNotification", matchNotificationSchema);
