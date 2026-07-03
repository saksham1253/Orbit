// BackEnd/services/fcm.js
//
// Firebase Cloud Messaging (FCM) — server-initiated push so the Android APK
// receives notifications even when the app is fully killed (the Socket.io path
// only works while the app process is alive). Everything here is feature-gated
// behind FCM_ENABLED and lazily initialised, so a host without Firebase creds
// (e.g. the free failover backends) runs exactly as before — every export is a
// safe no-op when disabled, and no call site ever needs to care.
//
// Setup (see the plan / .env.example):
//   FCM_ENABLED=true
//   FCM_SERVICE_ACCOUNT_JSON=<the service-account JSON, raw or base64>
//
// Tokens are registered by the client via /api/device/token and live on
// User.fcmTokens. Dead tokens are pruned automatically on send.

const User = require("../models/user");

let messaging = null;      // cached messaging() instance
let initState = "pending"; // "pending" | "ready" | "disabled"

/**
 * Parse the service-account credential from the env var. Accepts either raw
 * JSON or a base64-encoded JSON blob (handy for dashboards that mangle
 * multiline secrets). Returns the parsed object or null.
 */
function parseServiceAccount() {
    const raw = process.env.FCM_SERVICE_ACCOUNT_JSON;
    if (!raw) return null;
    const text = raw.trim();
    try {
        if (text.startsWith("{")) return JSON.parse(text);
        // Assume base64 otherwise.
        return JSON.parse(Buffer.from(text, "base64").toString("utf8"));
    } catch (err) {
        console.error("[fcm] FCM_SERVICE_ACCOUNT_JSON could not be parsed:", err.message);
        return null;
    }
}

/**
 * Lazily initialise firebase-admin exactly once. Logs a single line on the
 * outcome and flips initState so subsequent calls are cheap. Never throws.
 * @returns {boolean} true if messaging is ready
 */
function ensureInit() {
    if (initState === "ready") return true;
    if (initState === "disabled") return false;

    // From here we resolve the pending state to ready/disabled exactly once.
    if (process.env.FCM_ENABLED !== "true") {
        initState = "disabled";
        console.log("[fcm] disabled (FCM_ENABLED is not 'true') — push is a no-op.");
        return false;
    }

    const serviceAccount = parseServiceAccount();
    if (!serviceAccount) {
        initState = "disabled";
        console.warn("[fcm] enabled but no valid FCM_SERVICE_ACCOUNT_JSON — push disabled.");
        return false;
    }

    try {
        // firebase-admin v14 is modular — the old `admin.credential.cert` /
        // `admin.messaging()` off the default export no longer exist, so import
        // the app + messaging subpaths directly.
        const { initializeApp, getApps, cert } = require("firebase-admin/app");
        const { getMessaging } = require("firebase-admin/messaging");
        if (!getApps().length) {
            initializeApp({ credential: cert(serviceAccount) });
        }
        messaging = getMessaging();
        initState = "ready";
        console.log("[fcm] initialised — push notifications active.");
        return true;
    } catch (err) {
        initState = "disabled";
        console.error("[fcm] init failed — push disabled:", err.message);
        return false;
    }
}

/** Whether push is configured and ready. */
function isEnabled() {
    return ensureInit();
}

/**
 * Send a push to every device a user has registered. No-op when disabled, when
 * the user has no tokens, or on any error — never throws, so callers can
 * fire-and-forget alongside the existing best-effort socket emits.
 *
 * Uses a `notification` payload so Android auto-displays the tray entry when the
 * app is backgrounded/killed; `data.link` drives tap-to-route on the client.
 *
 * @param {string} userId
 * @param {{ title?: string, body?: string, data?: object }} opts
 */
async function sendToUser(userId, { title = "Orbit", body = "", data = {} } = {}) {
    if (!ensureInit()) return;

    try {
        const user = await User.findById(userId).select("fcmTokens").lean();
        const tokens = (user && user.fcmTokens) || [];
        if (!tokens.length) return;

        // FCM data values must be strings.
        const stringData = {};
        for (const [k, v] of Object.entries(data || {})) {
            if (v != null) stringData[k] = String(v);
        }

        const res = await messaging.sendEachForMulticast({
            tokens,
            notification: { title, body },
            data: stringData,
            android: { priority: "high", notification: { sound: "default" } },
        });

        // Prune tokens FCM reports as permanently invalid so we stop retrying.
        if (res.failureCount > 0) {
            const dead = [];
            res.responses.forEach((r, i) => {
                const code = r.error && r.error.code;
                if (
                    code === "messaging/registration-token-not-registered" ||
                    code === "messaging/invalid-registration-token" ||
                    code === "messaging/invalid-argument"
                ) {
                    dead.push(tokens[i]);
                }
            });
            if (dead.length) {
                await User.updateOne({ _id: userId }, { $pull: { fcmTokens: { $in: dead } } });
            }
        }
    } catch (err) {
        // Best-effort: a push failure must never affect the request that triggered it.
        console.error("[fcm] sendToUser error:", err.message);
    }
}

module.exports = { sendToUser, isEnabled };
