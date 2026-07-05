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
const MIN_STREAK    = 3;     // only nudge streaks worth protecting
const MAX_BATCH      = 2000; // safety cap per run
const { PHASES } = require("../services/orbitConfig");
const GRADUATION_DAYS = PHASES.consistencyMax; // >60d by default → graduated (pride, not pressure)

function msUntilNextRun(hour = RUN_HOUR_UTC, minute = 7) {
    const now  = new Date();
    const next = new Date();
    next.setUTCHours(hour, minute, 0, 0);
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    return next - now;
}

async function runOrbitReminders(io) {
    // Live flag (C1): honor the runtime ORBIT_DECAY_REMINDERS toggle each run so
    // reminders can be silenced from the Flag Cockpit without a redeploy.
    if (!require("../services/flagStore").get("ORBIT_DECAY_REMINDERS")) {
        console.log("[OrbitWorker] Decay reminders disabled via flag — skipping this run.");
        setTimeout(() => runOrbitReminders(io), 24 * 60 * 60 * 1000);
        return;
    }
    const today = utcDayStr();
    console.log("[OrbitWorker] Scanning for decaying orbits…");
    let sent = 0;

    try {
        const atRisk = await User.find({
            "orbit.streak.current": { $gte: MIN_STREAK },
            "orbit.streak.lastActionDay": { $ne: today },
            "orbit.prefs.decayReminders": { $ne: false },   // Part 4: user opt-out honored
            status: { $ne: "banned" },
        })
            .select("orbit.streak.current orbit.streak.longest orbit.freeze.tokens name")
            .limit(MAX_BATCH)
            .lean();

        for (const u of atRisk) {
            const streak = (u.orbit && u.orbit.streak && u.orbit.streak.current) || 0;
            const longest = (u.orbit && u.orbit.streak && u.orbit.streak.longest) || 0;
            const tokens = (u.orbit && u.orbit.freeze && u.orbit.freeze.tokens) || 0;
            const graduated = longest > GRADUATION_DAYS;

            // Part 3 & 4 — supportive & factual, NEVER guilt-based. Graduated
            // streaks get pride framing with the daily pressure dialed right down;
            // if they even have a Gravity Assist we simply reassure them it'll
            // bridge today, so there's no urgency at all.
            let title, body;
            if (graduated) {
                title = "🌟 Your Fixed Star is shining";
                body = tokens > 0
                    ? `Your ${streak}-day orbit is glowing — and a Gravity Assist has today covered. No rush.`
                    : `Your ${streak}-day orbit is glowing. Whenever you're ready, one swap keeps it bright.`;
            } else {
                title = "🔥 Your orbit is glowing";
                body = tokens > 0
                    ? `Your ${streak}-day orbit is glowing — one swap keeps it alive, or a Gravity Assist (${tokens} left) will bridge today.`
                    : `Your ${streak}-day orbit is glowing — one swap, message, or review keeps it alive today.`;
            }

            await createNotification(io, u._id, {
                type: "orbit_decay",
                title,
                body,
                data: { link: "/orbit", streak, freezeTokens: tokens, graduated },
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
 *
 * Gated by ORBIT_DECAY_REMINDERS so the daily nudges can be soft-launched: set
 * ORBIT_DECAY_REMINDERS=false to keep the whole Orbit Engine live but silence
 * the push reminders (the streak/missions/Stardust all still work). Enabled by
 * default so no config is needed to get the intended behaviour.
 */
function startOrbitWorker(io) {
    if (String(process.env.ORBIT_DECAY_REMINDERS).toLowerCase() === "false") {
        console.log("[OrbitWorker] Decay reminders disabled (ORBIT_DECAY_REMINDERS=false). Skipping schedule.");
        return;
    }
    const delay = msUntilNextRun();
    console.log(`[OrbitWorker] Scheduled. First run in ${(delay / 3600000).toFixed(1)}h (at ${RUN_HOUR_UTC}:07 UTC).`);
    setTimeout(() => runOrbitReminders(io), delay);
}

module.exports = { startOrbitWorker, runOrbitReminders };
