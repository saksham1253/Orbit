/**
 * skillMastery.js — pure per-skill mastery ladder (Orbit Engine, Tier 3).
 *
 * NO I/O. A skill's "sessions taught" (completed swaps where the owner taught)
 * maps to a named teaching rank — e.g. 10 sessions of Guitar → "Guitar Mentor".
 * The controller persists the count; this module only interprets it, so the
 * ladder is unit-testable in isolation (mirrors orbitEngine.js).
 */

// Ascending thresholds. `title` combines with the skill name ("Guitar Mentor").
// `stardust` is awarded once, when the rank is first reached.
const MASTERY_TIERS = Object.freeze([
    { level: 1, count: 1,  title: "Initiate",    stardust: 20  },
    { level: 2, count: 3,  title: "Apprentice",  stardust: 40  },
    { level: 3, count: 10, title: "Mentor",      stardust: 120 },
    { level: 4, count: 25, title: "Master",      stardust: 300 },
    { level: 5, count: 50, title: "Grandmaster", stardust: 700 },
]);

/** The highest tier reached at `count` sessions (or null if below the first). */
function currentTier(count) {
    let tier = null;
    for (const t of MASTERY_TIERS) if (count >= t.count) tier = t;
    return tier;
}

/** The next tier above `count` (or null once maxed). */
function nextTier(count) {
    return MASTERY_TIERS.find((t) => count < t.count) || null;
}

/**
 * masteryFor — full mastery view for a skill.
 * @param {number} sessionsTaught
 * @param {string} [skillName]  e.g. "Guitar" → badge "Guitar Mentor"
 * @returns {{ level, rank, badge, sessionsTaught, next, progressPct, toNext }}
 */
function masteryFor(sessionsTaught = 0, skillName = "") {
    const count = Math.max(0, sessionsTaught || 0);
    const cur = currentTier(count);
    const next = nextTier(count);
    const name = String(skillName || "").trim();

    // Progress from the current tier's floor toward the next tier's threshold.
    const floor = cur ? cur.count : 0;
    const ceil = next ? next.count : (cur ? cur.count : 1);
    const span = Math.max(1, ceil - floor);
    const progressPct = next ? Math.min(100, Math.round(((count - floor) / span) * 100)) : 100;

    return {
        level: cur ? cur.level : 0,
        rank: cur ? cur.title : null,                              // "Mentor"
        badge: cur ? (name ? `${name} ${cur.title}` : cur.title) : null, // "Guitar Mentor"
        sessionsTaught: count,
        next: next ? { title: next.title, count: next.count, stardust: next.stardust } : null,
        toNext: next ? Math.max(0, next.count - count) : 0,
        progressPct,
        maxed: !next,
    };
}

/**
 * tierReachedOnIncrement — the tier newly CROSSED when the count went from
 * `prevCount` to `newCount` (or null). Used to award Stardust exactly once.
 */
function tierReachedOnIncrement(prevCount, newCount) {
    return MASTERY_TIERS.find((t) => prevCount < t.count && newCount >= t.count) || null;
}

module.exports = {
    MASTERY_TIERS,
    currentTier, nextTier, masteryFor, tierReachedOnIncrement,
};
