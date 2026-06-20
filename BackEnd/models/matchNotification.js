const mongoose = require("mongoose");

/**
 * MatchNotification — de-dupe bookkeeping for perfect-match announcements (v7 §3).
 *
 * One row per user PAIR (not per skill), so a reciprocal "perfect match" is
 * announced to both people exactly once — adding more skills later never
 * re-spams the same pair. `pairKey` is the two user ids sorted + joined ("a__b")
 * so the order users post in doesn't matter. This is purely notification state;
 * it never touches cosmic standing or any user record.
 */
const matchNotificationSchema = new mongoose.Schema({
    pairKey: {
        type: String,
        required: true,
        unique: true
    }
}, { timestamps: true });

/** Canonical, order-independent key for a pair of user ids. */
matchNotificationSchema.statics.keyFor = function (a, b) {
    return [String(a), String(b)].sort().join("__");
};

module.exports = mongoose.model("MatchNotification", matchNotificationSchema);
