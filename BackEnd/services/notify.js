const Notification = require("../models/Notification");
const fcm = require("./fcm");

/**
 * createNotification — persist a notification THEN push it live.
 *
 * Persistence is the source of truth (survives offline / socket-not-yet-
 * connected, which is the normal case on mobile). The socket emit is the
 * instant nudge layered on top. We preserve the EXISTING per-type socket event
 * + payload (`legacy`) so the current live toasts keep working unchanged, and
 * additionally emit a generic "notification:new" so the bell can refresh its
 * unread count/list. Socket work is best-effort — it never throws and never
 * blocks the caller; persistence has already happened by then.
 *
 * @param {object|null} io        socket.io server (req.app.get("io"))
 * @param {string} userId         recipient user id
 * @param {object} opts
 * @param {string} opts.type      notification type (perfect_match, ...)
 * @param {string} [opts.title]
 * @param {string} [opts.body]
 * @param {object} [opts.data]    UI payload (otherUserId, link, ...)
 * @param {{event:string, payload:object}} [opts.legacy]  existing live event to keep firing
 * @returns {Promise<object>} the persisted Notification doc
 */
async function createNotification(io, userId, { type, title = "", body = "", data = {}, legacy } = {}) {
    const doc = await Notification.create({ userId, type, title, body, data });

    if (io) {
        try {
            // Keep the existing per-type event so current toast listeners fire.
            if (legacy && legacy.event) {
                io.to(`user_${userId}`).emit(legacy.event, legacy.payload || {});
            }
            // Generic event the notification center listens to (refresh badge/list).
            io.to(`user_${userId}`).emit("notification:new", {
                _id: String(doc._id),
                type, title, body, data,
                read: false,
                createdAt: doc.createdAt,
            });
        } catch (_) {
            /* live push is best-effort; the record is already persisted */
        }
    }

    // Native push (FCM) so the APK gets a tray entry even when fully killed —
    // the socket emit above only reaches a live app. Fire-and-forget; no-op when
    // FCM is unconfigured and never throws.
    fcm.sendToUser(userId, { title, body, data }).catch(() => {});

    return doc;
}

module.exports = { createNotification };
