/**
 * constellationEngine.js — pure math for co-op "Binary Star" shared streaks
 * (Orbit Engine, Tier 2). NO I/O, NO Date.now()/Math.random(); the day/week are
 * always passed in as UTC strings. Reuses the personal streak's date helpers so
 * both systems agree on day boundaries, and mirrors its mercy model (a shared
 * weekly Gravity Assist bridges a missed day).
 *
 * The shared streak advances ONLY when BOTH members have taken a real-progress
 * action on the same UTC day.
 */

const { toDayNum, dayGap } = require("./orbitEngine");

// ── Tunables (pair-specific) ─────────────────────────────────────────────────
const FREEZE_CAP_PAIR          = 2;   // a pair banks fewer freezes than a solo user
const WEEKLY_FREEZE_GRANT_PAIR = 1;

// Shared-streak milestones. `stardust` is paid to EACH member.
const PAIR_MILESTONES = Object.freeze([
    { days: 3,   name: "Binary Ignition", stardust: 40   },
    { days: 7,   name: "Steady Binary",   stardust: 100  },
    { days: 14,  name: "Bright Binary",   stardust: 200  },
    { days: 30,  name: "Twin Suns",       stardust: 500  },
    { days: 60,  name: "Nova Pair",       stardust: 1000 },
    { days: 100, name: "Eternal Binary",  stardust: 2000 },
]);

const clampFreezePair = (n) => Math.max(0, Math.min(FREEZE_CAP_PAIR, n || 0));

/**
 * applyPairContribution — record `userId`'s action for `today`, and if BOTH
 * members have now acted today, advance the shared streak (once/day, with a
 * freeze bridge for missed days).
 *
 * @param {object} state
 *   { streak:{current,longest,lastBothDay,milestonesHit}, lastActionDay:{}, freezeTokens }
 * @param {string} userId       the acting member's id (string)
 * @param {[string,string]} memberIds  both member ids (strings)
 * @param {string} today        "YYYY-MM-DD" UTC
 * @returns {{ state, recorded, advanced, streakSaved, freezeUsed, milestone, stardustEach }}
 */
function applyPairContribution(state, userId, memberIds, today) {
    const s = {
        streak: {
            current: (state.streak && state.streak.current) || 0,
            longest: (state.streak && state.streak.longest) || 0,
            lastBothDay: (state.streak && state.streak.lastBothDay) || null,
            milestonesHit: (state.streak && Array.isArray(state.streak.milestonesHit)) ? [...state.streak.milestonesHit] : [],
        },
        lastActionDay: { ...(state.lastActionDay || {}) },
        freezeTokens: clampFreezePair(state.freezeTokens),
    };

    // Record this member's contribution for today.
    s.lastActionDay[String(userId)] = today;

    const [a, b] = memberIds.map(String);
    const bothToday = s.lastActionDay[a] === today && s.lastActionDay[b] === today;

    // Not both yet, or the pair already advanced today → contribution recorded,
    // no streak change.
    if (!bothToday || s.streak.lastBothDay === today) {
        return { state: s, recorded: true, advanced: false, streakSaved: false, freezeUsed: 0, milestone: null, stardustEach: 0 };
    }

    // Advance the shared streak.
    let freezeUsed = 0, streakSaved = false;
    if (!s.streak.lastBothDay) {
        s.streak.current = 1;
    } else {
        const gap = dayGap(s.streak.lastBothDay, today);   // ≥ 1
        if (gap === 1) {
            s.streak.current += 1;
        } else if (gap > 1) {
            const missed = gap - 1;
            if (s.streak.current > 0 && s.freezeTokens >= missed) {
                s.freezeTokens -= missed;
                s.streak.current += 1;
                freezeUsed = missed;
                streakSaved = true;
            } else {
                s.streak.current = 1;
            }
        } else {
            s.streak.current = Math.max(1, s.streak.current);
        }
    }
    s.streak.lastBothDay = today;
    s.streak.longest = Math.max(s.streak.longest, s.streak.current);

    // Milestone payout (once ever), paid to each member.
    let milestone = null, stardustEach = 0;
    const hit = PAIR_MILESTONES.find((m) => m.days === s.streak.current && !s.streak.milestonesHit.includes(m.days));
    if (hit) {
        milestone = hit;
        stardustEach = hit.stardust;
        s.streak.milestonesHit.push(hit.days);
    }

    return { state: s, recorded: true, advanced: true, streakSaved, freezeUsed, milestone, stardustEach };
}

/** Grant one shared freeze at each new ISO week (idempotent within a week). */
function grantWeeklyFreezePair(freeze, weekId) {
    const f = { tokens: clampFreezePair(freeze && freeze.tokens), lastGrantWeek: (freeze && freeze.lastGrantWeek) || "" };
    if (f.lastGrantWeek === weekId) return { freeze: f, granted: false };
    const before = f.tokens;
    f.tokens = clampFreezePair(f.tokens + WEEKLY_FREEZE_GRANT_PAIR);
    f.lastGrantWeek = weekId;
    return { freeze: f, granted: f.tokens > before };
}

/**
 * pairDecayState — is the shared streak safe today, waiting on one member, or
 * decaying? Pure view helper for the UI.
 *
 * @returns {{ state:'active'|'waiting'|'decaying'|'idle', waitingOn:string|null }}
 *   active   — both acted today, streak advanced
 *   waiting  — one member acted today, the other hasn't yet
 *   decaying — neither acted today but a streak is in flight
 *   idle     — no streak yet
 */
function pairDecayState(streak, lastActionDay, memberIds, today) {
    const cur = (streak && streak.current) || 0;
    const [a, b] = memberIds.map(String);
    const la = (lastActionDay || {})[a];
    const lb = (lastActionDay || {})[b];
    const aToday = la === today, bToday = lb === today;

    if (streak && streak.lastBothDay === today) return { state: "active", waitingOn: null };
    if (aToday || bToday) return { state: "waiting", waitingOn: aToday ? b : a };
    if (cur > 0) return { state: "decaying", waitingOn: null };
    return { state: "idle", waitingOn: null };
}

/** Next shared milestone strictly above `current`, or null. */
function nextPairMilestone(current) {
    return PAIR_MILESTONES.find((m) => m.days > (current || 0)) || null;
}

/** Canonical sorted pair key for the unique index. */
function pairKeyOf(idA, idB) {
    return [String(idA), String(idB)].sort().join("_");
}

module.exports = {
    FREEZE_CAP_PAIR, WEEKLY_FREEZE_GRANT_PAIR, PAIR_MILESTONES,
    toDayNum, dayGap,          // re-exported for convenience/tests
    applyPairContribution, grantWeeklyFreezePair, pairDecayState, nextPairMilestone, pairKeyOf,
};
