const mongoose = require("mongoose");

/**
 * Notification — a DURABLE, per-user notification record.
 *
 * Until now notifications were socket-only and ephemeral: if the recipient's
 * socket wasn't connected at emit time (always true on a closed/backgrounded
 * APK), the notification was lost with no history. This model is the source of
 * truth — the socket emit is just an instant nudge on top of it. Read via the
 * notification center (bell), marked read per-item or all at once.
 */
const notificationSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    // e.g. "perfect_match" | "connection_request" | "connection_accepted"
    type:  { type: String, required: true },
    title: { type: String, default: "" },
    body:  { type: String, default: "" },
    // Free-form payload the UI uses to build links/avatars (e.g. otherUserId).
    data:  { type: mongoose.Schema.Types.Mixed, default: {} },
    read:  { type: Boolean, default: false },
}, { timestamps: true });

// Hot read path: a user's notifications, unread-first filtering, newest first.
notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
