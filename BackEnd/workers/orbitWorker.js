/**
 * orbitWorker.js — Orbit Engine daily decay reminder.
 *
 * Mirrors archiveWorker/seasonWorker: an in-process scheduled job (Node
 * setInterval, no external cron needed on Render's long-lived process). Once a
 * day, late in the UTC day, it nudges users whose orbit is DECAYING — they have
 * a streak worth protecting (≥ MIN_STREAK) but haven't taken a real-progress
 * action today. Loss-aversion is the whole point: the message frames the streak
 * as decaying and tells them a single swap keeps it alive (or that a Gravity
 * Assist will bridge the gap if they have one).
 *
 * Safe & cheap: one durable Notification per at-risk user per day (the notify
 * service also fans out socket + FCM). Best-effort; never throws.
 */

const User = require("../models/user");
const { createNotification } = require("../services/notify");
const { utcDayStr } = require("../services/orbitActivity");

const RUN_HOUR_UTC = 21;     // ~end of the UTC day — last call before it resets
const MIN_STREAK    = 3;     // only nudge streaks worth the loss-aversion pull
const MAX_BATCH      = 2000; // safety cap per run

function msUntilNextRun(hour = RUN_HOUR_UTC, minute = 7) {
    const now  = new Date();
    const next = new Date();
    next.setUTCHours(hour, minute, 0, 0);
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    return next - now;
}

async function runOrbitReminders(io) {
    const today = utcDayStr();
    console.log("[OrbitWorker] Scanning for decaying orbits…");
    let sent = 0;

    try {
        const atRisk = await User.find({
            "orbit.streak.current": { $gte: MIN_STREAK },
            "orbit.streak.lastActionDay": { $ne: today },
            status: { $ne: "banned" },
        })
            .select("orbit.streak.current orbit.freeze.tokens name")
            .limit(MAX_BATCH)
            .lean();

        for (const u of atRisk) {
            const streak = (u.orbit && u.orbit.streak && u.orbit.streak.current) || 0;
            const tokens = (u.orbit && u.orbit.freeze && u.orbit.freeze.tokens) || 0;
            const body = tokens > 0
                ? `Your ${streak}-day orbit is decaying. Do 1 swap to stay in orbit — or a Gravity Assist (${tokens} left) will bridge today.`
                : `Your ${streak}-day orbit is decaying. Do 1 swap, message, or review before midnight UTC to stay in orbit.`;

            await createNotification(io, u._id, {
                type: "orbit_decay",
                title: "🌌 Your orbit is decaying",
                body,
                data: { link: "/orbit", streak, freezeTokens: tokens },
            }).catch(() => {});
            sent++;
        }
    } catch (err) {
        console.error("[OrbitWorker] error:", err.message);
    }

    console.log(`[OrbitWorker] Sent ${sent} decay reminder(s). Next run in ~24h.`);
    setTimeout(() => runOrbitReminders(io), 24 * 60 * 60 * 1000);
}

/**
 * startOrbitWorker(io) — call once from server.js after DB connects. Schedules
 * the first run at RUN_HOUR_UTC, then every 24h.
 */
function startOrbitWorker(io) {
    const delay = msUntilNextRun();
    console.log(`[OrbitWorker] Scheduled. First run in ${(delay / 3600000).toFixed(1)}h (at ${RUN_HOUR_UTC}:07 UTC).`);
    setTimeout(() => runOrbitReminders(io), delay);
}

module.exports = { startOrbitWorker, runOrbitReminders };
