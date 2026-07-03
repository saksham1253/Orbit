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
const league = require("./leagueService");
const antiGame = require("./orbitAntiGame");
const cfg = require("./orbitConfig");
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
        league: {
            divisionId: (o.league && o.league.divisionId) || league.DIVISION_IDS[0],
            groupId: (o.league && o.league.groupId) || "",
            weekXp: (o.league && o.league.weekXp) || 0,
            weekId: (o.league && o.league.weekId) || "",
            lastResult: (o.league && o.league.lastResult) || "",
            highestDivisionId: (o.league && o.league.highestDivisionId) || (o.league && o.league.divisionId) || league.DIVISION_IDS[0],
            sourceXp: { message: (o.league && o.league.sourceXp && o.league.sourceXp.message) || 0 },
        },
        msgCredit: {
            day: (o.msgCredit && o.msgCredit.day) || null,
            partners: (o.msgCredit && Array.isArray(o.msgCredit.partners)) ? [...o.msgCredit.partners] : [],
        },
        prefs: {
            decayReminders: !(o.prefs && o.prefs.decayReminders === false),
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

    // League weekly reset: when the ISO week changes, this week's XP starts at 0
    // and a provisional group is assigned in the current division (the rollover
    // worker rebalances groups by CosmicScore at week boundaries). Self-heals a
    // user the worker hasn't touched. Division/highest are preserved.
    let leagueChanged = false;
    if (o.league.weekId !== weekId) {
        o.league.weekXp = 0;
        o.league.sourceXp = { message: 0 };   // reset per-source weekly caps
        o.league.weekId = weekId;
        o.league.groupId = `${o.league.divisionId}:${weekId}:0`;
        leagueChanged = true;
    } else if (!o.league.groupId) {
        o.league.groupId = `${o.league.divisionId}:${weekId}:0`;
        leagueChanged = true;
    }

    return { orbit: o, changed: g.granted || m.rolled || leagueChanged, weekId };
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

        // 0) Anti-gaming (Part 1) — swaps & reviews are real value and always
        //    count in full. A MESSAGE only earns credit from a partner not
        //    already credited today (distinct-partner rule); XP tapers to 0 past
        //    the daily cap. This makes messages a weak *fallback* streak trigger,
        //    never the primary path, and impossible to farm.
        let streakEligible = true;
        let xpFactor = 1;
        if (metric === "message") {
            const q = antiGame.qualifyMessage(orbit.msgCredit, opts.partnerId, today, {
                dailyXpCap: cfg.MSG.dailyXpCap,
                quality: cfg.MSG.qualityGate ? opts.quality !== false : true,
            });
            orbit.msgCredit = q.msgCredit;
            streakEligible = q.qualifiesForStreak;
            xpFactor = q.xpFactor;
        }

        // 1) Streak — advance for this real-progress day (swap/review always; a
        //    message only when it qualifies). freezeTokens live on orbit.freeze.
        let res;
        if (streakEligible) {
            const streakIn = { ...orbit.streak, freezeTokens: orbit.freeze.tokens };
            res = engine.applyAction(streakIn, today);
            orbit.streak = {
                current: res.streak.current,
                longest: res.streak.longest,
                lastActionDay: res.streak.lastActionDay,
                milestonesHit: res.streak.milestonesHit,
            };
            orbit.freeze.tokens = res.streak.freezeTokens;
            orbit.stardust += res.stardust;
        } else {
            // Non-qualifying message: no streak change, no drip, no milestone.
            res = { counted: false, streak: orbit.streak, streakSaved: false, milestone: null, stardust: 0 };
        }

        // 2) Missions — bump the action's own metric only when it earned credit
        //    (so message missions can't be farmed); bump "streak_day" once/day.
        const completed = [];
        if (streakEligible || metric !== "message") {
            let mp = engine.applyMissionProgress(orbit.missions, metric, amount);
            orbit.missions = mp.missions; completed.push(...mp.completedNow);
        }
        if (res.counted) {
            const mp2 = engine.applyMissionProgress(orbit.missions, "streak_day", 1);
            orbit.missions = mp2.missions; completed.push(...mp2.completedNow);
        }

        // 3) Weekly League XP — swap/review/mission/milestone dominate; message XP
        //    is scaled by the daily taper AND clamped to a weekly per-source cap
        //    (Part 2) so message-only play can never fund a promotion. rollForward
        //    already reset weekXp + sourceXp to 0 when the ISO week changed.
        let addXp = league.xpFor(metric) * amount * xpFactor + (res.milestone ? league.XP_MILESTONE : 0);
        if (metric === "message" && addXp > 0) {
            const capped = antiGame.applyWeeklyCap(orbit.league.sourceXp.message, addXp, cfg.MSG.weeklyXpCap);
            orbit.league.sourceXp.message = capped.total;
            addXp = capped.granted;
        }
        orbit.league.weekXp += addXp;

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
