/**
 * orbitEngine.js — pure engagement math for the Orbit Engine (Tier‑1:
 * Orbit Streak + Gravity Assist freeze + Weekly Missions + Stardust).
 *
 * NO database access, NO I/O, NO Date.now()/Math.random(). Every export is a
 * pure function of its inputs — the day/week are always passed in as UTC strings
 * ("YYYY-MM-DD" / ISO "YYYY-Www"). This mirrors services/cosmicScore.js so the
 * whole engine is unit-testable in isolation and reused by the controller, the
 * action hook, and the reminder worker.
 *
 * Design (grounded in 2025 streak research):
 *   - the streak advances on REAL progress days (a completed swap / a message to
 *     a partner / a rating), never on mere app-opens;
 *   - pressure is always paired with MERCY — a weekly Gravity Assist freeze is
 *     auto-consumed to bridge a missed day so one bad day never nukes a long
 *     streak;
 *   - capped milestone "orbits" (3/7/14/30/60/100) deliver accomplishment peaks
 *     and pay Stardust, the cosmetic currency.
 */

// ── Tunables ────────────────────────────────────────────────────────────────
const FREEZE_CAP           = 3;   // max Gravity Assist tokens a user can bank
const WEEKLY_FREEZE_GRANT  = 1;   // tokens granted at each new ISO week
const FREEZE_STARDUST_COST = 200; // Stardust to buy one extra Gravity Assist
const MISSIONS_PER_WEEK    = 3;   // rotating goals per week
const ACTIVE_DAY_STARDUST  = 5;   // tiny drip for a real-progress day

// Milestone "orbits" — reaching one pays Stardust once (milestonesHit guards).
const MILESTONES = Object.freeze([
    { days: 3,   name: "Liftoff",        stardust: 20  },
    { days: 7,   name: "Low Orbit",      stardust: 60  },
    { days: 14,  name: "High Orbit",     stardust: 120 },
    { days: 30,  name: "Geostationary",  stardust: 300 },
    { days: 60,  name: "Lunar Transfer", stardust: 700 },
    { days: 100, name: "Deep Space",     stardust: 1500 },
]);

// Weekly mission template pool. `metric` maps to the action types the hook
// knows how to increment (see services/orbitActivity.js). A deterministic pick
// of MISSIONS_PER_WEEK of these rotates each ISO week.
const MISSION_TEMPLATES = Object.freeze([
    { key: "teach_two",     metric: "swap",       target: 2, stardust: 120, label: "Twin Stars",       description: "Complete 2 skill swaps this week" },
    { key: "reach_out",     metric: "message",    target: 8, stardust: 80,  label: "Signal Beacon",    description: "Send 8 messages to swap partners" },
    { key: "leave_review",  metric: "rating",     target: 1, stardust: 60,  label: "Stellar Feedback", description: "Leave a review for a partner" },
    { key: "review_three",  metric: "rating",     target: 3, stardust: 160, label: "Constellation",    description: "Review 3 different partners" },
    { key: "stay_in_orbit", metric: "streak_day", target: 4, stardust: 140, label: "Steady Orbit",     description: "Stay in orbit 4 days this week" },
    { key: "daily_pull",    metric: "streak_day", target: 6, stardust: 220, label: "Gravity Well",     description: "Stay in orbit 6 days this week" },
    { key: "one_swap",      metric: "swap",       target: 1, stardust: 70,  label: "First Contact",    description: "Complete 1 skill swap this week" },
    { key: "chatterbox",    metric: "message",    target: 15,stardust: 150, label: "Deep Space Comms", description: "Send 15 messages to partners" },
]);

// ── Pure date helpers (UTC, string-in) ──────────────────────────────────────
/** Whole-day number since the Unix epoch for a "YYYY-MM-DD" UTC date string. */
function toDayNum(dateStr) {
    if (!dateStr) return null;
    const [y, m, d] = String(dateStr).split("-").map(Number);
    return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

/** Gap in whole days between two "YYYY-MM-DD" strings (b − a). */
function dayGap(aStr, bStr) {
    const a = toDayNum(aStr), b = toDayNum(bStr);
    if (a == null || b == null) return null;
    return b - a;
}

// ── Streak ──────────────────────────────────────────────────────────────────
const clampFreeze = (n) => Math.max(0, Math.min(FREEZE_CAP, n));

/**
 * applyAction — advance the streak for a real-progress action taken on `today`.
 *
 * @param {object} streak { current, longest, lastActionDay, freezeTokens, milestonesHit? }
 * @param {string} today  "YYYY-MM-DD" UTC
 * @returns {{ streak, counted, streakSaved, freezeUsed, milestone, stardust }}
 *   counted     — false when the day was already counted (idempotent per day)
 *   streakSaved — true when a Gravity Assist bridged one or more missed days
 *   freezeUsed  — number of freeze tokens consumed
 *   milestone   — the milestone object newly reached this action, or null
 *   stardust    — Stardust to award for this action (active-day drip + milestone)
 */
function applyAction(streak, today) {
    const s = {
        current: streak.current || 0,
        longest: streak.longest || 0,
        lastActionDay: streak.lastActionDay || null,
        freezeTokens: clampFreeze(streak.freezeTokens || 0),
        milestonesHit: Array.isArray(streak.milestonesHit) ? [...streak.milestonesHit] : [],
    };

    // Already acted today → no streak change, no double-drip.
    if (s.lastActionDay === today) {
        return { streak: s, counted: false, streakSaved: false, freezeUsed: 0, milestone: null, stardust: 0 };
    }

    let freezeUsed = 0, streakSaved = false;
    if (!s.lastActionDay) {
        s.current = 1;                                   // first ever action
    } else {
        const gap = dayGap(s.lastActionDay, today);      // ≥ 1 here
        if (gap === 1) {
            s.current += 1;                              // consecutive day
        } else if (gap > 1) {
            const missed = gap - 1;
            if (s.current > 0 && s.freezeTokens >= missed) {
                s.freezeTokens -= missed;                // Gravity Assist bridges the gap
                s.current += 1;
                freezeUsed = missed;
                streakSaved = true;
            } else {
                s.current = 1;                           // orbit decayed → reset
            }
        } else {
            // gap ≤ 0 (clock skew / same-or-earlier day) — treat as a fresh day
            // without breaking the streak.
            s.current = Math.max(1, s.current);
        }
    }

    s.lastActionDay = today;
    s.longest = Math.max(s.longest, s.current);

    // Milestone payout (once per milestone, ever).
    let milestone = null, stardust = ACTIVE_DAY_STARDUST;
    const hit = MILESTONES.find((m) => m.days === s.current && !s.milestonesHit.includes(m.days));
    if (hit) {
        milestone = hit;
        stardust += hit.stardust;
        s.milestonesHit.push(hit.days);
    }

    return { streak: s, counted: true, streakSaved, freezeUsed, milestone, stardust };
}

/**
 * decayState — pure view helper: given the streak and "now", is the orbit
 * decaying (acted on a prior day but not yet today) or already broken?
 *
 * @returns {{ state:'active'|'decaying'|'idle', daysSince:number|null }}
 *   active   — acted today, streak safe
 *   decaying — last action was yesterday; act today or (freeze permitting) lose it
 *   idle     — no streak in flight / already gapped beyond a freeze bridge
 */
function decayState(streak, today) {
    const last = streak && streak.lastActionDay;
    if (!last || !(streak.current > 0)) return { state: "idle", daysSince: null };
    const gap = dayGap(last, today);
    if (gap <= 0) return { state: "active", daysSince: 0 };
    if (gap === 1) return { state: "decaying", daysSince: 1 };
    return { state: "idle", daysSince: gap };
}

// ── Gravity Assist (weekly freeze grant) ─────────────────────────────────────
/**
 * grantWeeklyFreeze — top up one token at each new ISO week (idempotent within
 * a week). Pure; the caller supplies the current weekId.
 *
 * @returns {{ freeze:{tokens,lastGrantWeek}, granted:boolean }}
 */
function grantWeeklyFreeze(freeze, weekId) {
    const f = { tokens: clampFreeze(freeze && freeze.tokens), lastGrantWeek: (freeze && freeze.lastGrantWeek) || "" };
    if (f.lastGrantWeek === weekId) return { freeze: f, granted: false };
    const before = f.tokens;
    f.tokens = clampFreeze(f.tokens + WEEKLY_FREEZE_GRANT);
    f.lastGrantWeek = weekId;
    return { freeze: f, granted: f.tokens > before };
}

// ── Weekly Missions ──────────────────────────────────────────────────────────
/**
 * Deterministic shuffle (seeded LCG) so a given weekId always yields the same
 * mission set — reproducible, no Math.random, and identical across every server
 * replica for the same week.
 */
function seededOrder(weekId, length) {
    let seed = 0;
    for (const ch of String(weekId)) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    const idx = Array.from({ length }, (_, i) => i);
    for (let i = length - 1; i > 0; i--) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;   // LCG
        const j = seed % (i + 1);
        [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    return idx;
}

/** Pick MISSIONS_PER_WEEK templates deterministically for a week. */
function pickMissions(weekId, templates = MISSION_TEMPLATES, n = MISSIONS_PER_WEEK) {
    const order = seededOrder(weekId, templates.length);
    return order.slice(0, Math.min(n, templates.length)).map((i) => templates[i]);
}

/**
 * rollMissions — regenerate the week's mission set when the ISO week changes.
 * Preserves the existing set (and progress) within the same week — idempotent.
 *
 * @returns {{ missions:{weekId, items:[]}, rolled:boolean }}
 */
function rollMissions(missions, weekId, templates = MISSION_TEMPLATES) {
    if (missions && missions.weekId === weekId && Array.isArray(missions.items) && missions.items.length) {
        return { missions, rolled: false };
    }
    const items = pickMissions(weekId, templates).map((t) => ({
        key: t.key, metric: t.metric, target: t.target, stardust: t.stardust,
        label: t.label, description: t.description, progress: 0, claimed: false,
    }));
    return { missions: { weekId, items }, rolled: true };
}

/**
 * applyMissionProgress — bump every open mission matching `metric` by `amount`.
 * Returns the missions plus any items that CROSSED into completed this call
 * (so the caller can notify). Claiming stays manual (claimMission).
 *
 * @returns {{ missions, completedNow:Array }}
 */
function applyMissionProgress(missions, metric, amount = 1) {
    if (!missions || !Array.isArray(missions.items)) return { missions, completedNow: [] };
    const completedNow = [];
    const items = missions.items.map((it) => {
        if (it.metric !== metric || it.claimed) return it;
        const wasComplete = it.progress >= it.target;
        const progress = Math.min(it.target, it.progress + amount);
        const nowComplete = progress >= it.target;
        if (!wasComplete && nowComplete) completedNow.push({ ...it, progress });
        return { ...it, progress };
    });
    return { missions: { ...missions, items }, completedNow };
}

/**
 * claimMission — mark a completed mission claimed and return its Stardust.
 * @returns {{ missions, ok:boolean, stardust:number, reason?:string }}
 */
function claimMission(missions, key) {
    if (!missions || !Array.isArray(missions.items)) return { missions, ok: false, stardust: 0, reason: "no_missions" };
    let ok = false, stardust = 0, reason;
    const items = missions.items.map((it) => {
        if (it.key !== key) return it;
        if (it.claimed) { reason = "already_claimed"; return it; }
        if (it.progress < it.target) { reason = "incomplete"; return it; }
        ok = true; stardust = it.stardust;
        return { ...it, claimed: true };
    });
    if (!ok && !reason) reason = "not_found";
    return { missions: { ...missions, items }, ok, stardust, reason };
}

// ── Milestone helper ─────────────────────────────────────────────────────────
/** The next milestone strictly above `current` (for progress UI), or null. */
function nextMilestone(current) {
    return MILESTONES.find((m) => m.days > (current || 0)) || null;
}

// ── Streak graduation phases (Part 3) ────────────────────────────────────────
// Formation (0–29) leans on the daily countdown; Consistency (30–59) softens it;
// Graduation (60+) drops the pressure entirely for a permanent "Fixed Star"
// pride badge. Thresholds are passed in (from orbitConfig) so they're tunable.
const DEFAULT_PHASE_OPTS = { formationMax: 29, consistencyMax: 59 };

/** Which streak phase a `current` day-count is in. */
function phaseFor(current, opts = DEFAULT_PHASE_OPTS) {
    const fMax = opts.formationMax ?? 29;
    const cMax = opts.consistencyMax ?? 59;
    const c = current || 0;
    if (c > cMax) return "graduation";
    if (c > fMax) return "consistency";
    return "formation";
}

/**
 * graduationStatus — a supportive, non-anxious view of the streak's phase.
 * The "Fixed Star" badge is STICKY: it derives from `longest`, so a graduated
 * user who misses a day keeps the badge (pride, not punishment).
 *
 * @returns {{ phase, graduated, badge, pressure }}
 *   pressure: 'high'|'soft'|'none' — how much the daily countdown should be shown
 */
function graduationStatus(current, longest, opts = DEFAULT_PHASE_OPTS) {
    const cMax = opts.consistencyMax ?? 59;
    const phase = phaseFor(current, opts);
    const graduated = (longest || 0) > cMax;                 // sticky, from lifetime best
    const badge = graduated ? "Fixed Star" : (phaseFor(longest, opts) === "consistency" ? "Constant" : null);
    const pressure = phase === "graduation" ? "none" : phase === "consistency" ? "soft" : "high";
    return { phase, graduated, badge, pressure };
}

module.exports = {
    // constants
    FREEZE_CAP, WEEKLY_FREEZE_GRANT, FREEZE_STARDUST_COST, MISSIONS_PER_WEEK,
    ACTIVE_DAY_STARDUST, MILESTONES, MISSION_TEMPLATES,
    // date helpers
    toDayNum, dayGap,
    // streak
    applyAction, decayState,
    // freeze
    grantWeeklyFreeze,
    // missions
    seededOrder, pickMissions, rollMissions, applyMissionProgress, claimMission,
    // graduation (Part 3)
    phaseFor, graduationStatus,
    // misc
    nextMilestone,
};
