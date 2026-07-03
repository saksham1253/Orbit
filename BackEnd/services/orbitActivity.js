/**
 * orbitActivity.js — the DB-touching layer for the Orbit Engine.
 *
 * All the math is delegated to services/orbitEngine.js (pure). This module owns
 * the "now" (UTC day / ISO week), loads & persists user.orbit, performs the lazy
 * weekly rollovers (Gravity Assist grant + mission regeneration — no cron), and
 * fires notifications via services/notify.js. Everything is best-effort: it never
 * throws into and never blocks the caller's request path.
 */

const User = require("../models/user");
const engine = require("./orbitEngine");
const { createNotification } = require("./notify");

// ── "now" helpers (UTC) ──────────────────────────────────────────────────────
/** "YYYY-MM-DD" UTC for a Date. */
function utcDayStr(now = new Date()) {
    return now.toISOString().slice(0, 10);
}

/** ISO-8601 week id "YYYY-Www" (UTC), weeks starting Monday. */
function isoWeekId(now = new Date()) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const dayNum = (d.getUTCDay() + 6) % 7;                 // Mon=0 … Sun=6
    d.setUTCDate(d.getUTCDate() - dayNum + 3);              // Thursday of this week
    const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
    const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
    firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
    const week = 1 + Math.round((d - firstThursday) / (7 * 86400000));
    return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// Normalize a possibly-undefined orbit sub-doc into a plain, fully-defaulted obj.
function normalizeOrbit(orbit = {}) {
    const o = orbit || {};
    return {
        streak: {
            current: (o.streak && o.streak.current) || 0,
            longest: (o.streak && o.streak.longest) || 0,
            lastActionDay: (o.streak && o.streak.lastActionDay) || null,
            milestonesHit: (o.streak && Array.isArray(o.streak.milestonesHit)) ? [...o.streak.milestonesHit] : [],
        },
        freeze: {
            tokens: (o.freeze && o.freeze.tokens) || 0,
            lastGrantWeek: (o.freeze && o.freeze.lastGrantWeek) || "",
        },
        stardust: o.stardust || 0,
        missions: {
            weekId: (o.missions && o.missions.weekId) || "",
            items: (o.missions && Array.isArray(o.missions.items)) ? o.missions.items.map((i) => ({ ...i })) : [],
        },
    };
}

/**
 * rollForward — apply the lazy weekly rollovers (freeze grant + mission
 * regeneration) to an orbit object for `now`. Pure over its input; returns a new
 * orbit plus whether anything changed. Shared by the read path (GET /me) and the
 * action path so both self-heal identically.
 */
function rollForward(orbit, now = new Date()) {
    const o = normalizeOrbit(orbit);
    const weekId = isoWeekId(now);

    const g = engine.grantWeeklyFreeze(o.freeze, weekId);
    o.freeze = g.freeze;

    const m = engine.rollMissions(o.missions, weekId);
    o.missions = m.missions;

    return { orbit: o, changed: g.granted || m.rolled, weekId };
}

/**
 * recordOrbitAction — the single entry point actions call. Advances the streak
 * (once/day), bumps matching missions, awards Stardust, and notifies. Metric is
 * one of "swap" | "message" | "rating". Fire-and-forget.
 *
 * @param {object|null} io      socket.io server (req.app.get("io"))
 * @param {string} userId
 * @param {"swap"|"message"|"rating"} metric
 * @param {object} [opts] { amount=1, now=new Date() }
 * @returns {Promise<object|null>} a small summary (or null on any failure)
 */
async function recordOrbitAction(io, userId, metric, opts = {}) {
    try {
        const now = opts.now || new Date();
        const amount = opts.amount || 1;
        const today = utcDayStr(now);

        const user = await User.findById(userId).select("orbit name").lean();
        if (!user) return null;

        let { orbit } = rollForward(user.orbit, now);

        // 1) Streak — advance for this real-progress day. freezeTokens live on
        //    orbit.freeze, so splice them in/out around the pure call.
        const streakIn = { ...orbit.streak, freezeTokens: orbit.freeze.tokens };
        const res = engine.applyAction(streakIn, today);
        orbit.streak = {
            current: res.streak.current,
            longest: res.streak.longest,
            lastActionDay: res.streak.lastActionDay,
            milestonesHit: res.streak.milestonesHit,
        };
        orbit.freeze.tokens = res.streak.freezeTokens;
        orbit.stardust += res.stardust;

        // 2) Missions — bump the action's own metric every time; bump the
        //    "streak_day" metric only on the first action of the day.
        const completed = [];
        let mp = engine.applyMissionProgress(orbit.missions, metric, amount);
        orbit.missions = mp.missions; completed.push(...mp.completedNow);
        if (res.counted) {
            mp = engine.applyMissionProgress(orbit.missions, "streak_day", 1);
            orbit.missions = mp.missions; completed.push(...mp.completedNow);
        }

        await User.updateOne({ _id: userId }, { $set: { orbit } });

        // 3) Notifications (best-effort, after persistence).
        if (res.milestone) {
            createNotification(io, userId, {
                type: "orbit_milestone",
                title: `🚀 ${res.milestone.name} reached!`,
                body: `${res.streak.current}-day orbit — +${res.milestone.stardust} Stardust.`,
                data: { link: "/orbit", streak: res.streak.current, stardust: res.milestone.stardust },
            }).catch(() => {});
        }
        if (res.streakSaved) {
            createNotification(io, userId, {
                type: "orbit_freeze_used",
                title: "🛡️ Gravity Assist engaged",
                body: `A missed day was bridged — your ${res.streak.current}-day orbit is intact. ${orbit.freeze.tokens} left.`,
                data: { link: "/orbit", freezeTokens: orbit.freeze.tokens },
            }).catch(() => {});
        }
        for (const c of completed) {
            createNotification(io, userId, {
                type: "orbit_mission_complete",
                title: "🎯 Mission complete",
                body: `“${c.label}” is done — claim +${c.stardust} Stardust.`,
                data: { link: "/orbit", missionKey: c.key, stardust: c.stardust },
            }).catch(() => {});
        }

        // 4) Co-op Binary Star streaks — fan this action into the user's active
        //    constellations. Required lazily to avoid a require cycle (constella-
        //    tionActivity depends on this module's date helpers). Fire-and-forget.
        require("./constellationActivity").recordPairAction(io, userId, { now }).catch(() => {});

        return {
            streak: orbit.streak.current,
            counted: res.counted,
            streakSaved: res.streakSaved,
            milestone: res.milestone ? res.milestone.name : null,
            completedMissions: completed.map((c) => c.key),
            stardust: orbit.stardust,
        };
    } catch (err) {
        console.warn("[orbit] recordOrbitAction failed:", err.message);
        return null;
    }
}

module.exports = {
    utcDayStr,
    isoWeekId,
    normalizeOrbit,
    rollForward,
    recordOrbitAction,
};
