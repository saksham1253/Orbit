/**
 * cosmicTier.js — pure score→tier mapping for the Cosmic Leaderboard.
 *
 * NO database access, NO side effects. Maps a 0..100 CosmicScore to a tier +
 * division and enforces the anti-inflation eligibility gates (spec §5, §6.6).
 *
 * Tier assignment is ABSOLUTE (threshold-based) so a small-town mentor can
 * still climb. Leaderboard RANK (#1, #2…) is relative within a scope and lives
 * in leaderboardService.js — not here.
 *
 * See COSMIC_LEADERBOARD_IMPLEMENTATION_PLAN.md §4.
 */

// ── Canonical tier ladder (v2 §2.2.1 rebased floors, 50..100) ──────────────
// Order matters: index 0 = lowest (Moon IV) … index 23 = highest (Galaxy I).
// `min` is the inclusive entry score (core) on the 50..100 CosmicScore.
// HARD RULE (v2): any score < 62.0 MUST resolve to a Moon tier.
// Quasar is OFF-ladder (retired #1 champions only) and is not in this array.
const LADDER = [
    // ── THE DESCENT (below Moon, scores 0..50) — v4 §2 ──
    { tierId: 'stardust_4', category: 'stardust', division: 4, min: 0.0,  displayName: 'Stardust IV — The Spark' },
    { tierId: 'stardust_3', category: 'stardust', division: 3, min: 6.0,  displayName: 'Stardust III — The Scatter' },
    { tierId: 'stardust_2', category: 'stardust', division: 2, min: 12.0, displayName: 'Stardust II — The Oort' },
    { tierId: 'stardust_1', category: 'stardust', division: 1, min: 18.0, displayName: 'Stardust I — The Zodiac' },

    { tierId: 'meteor_4',   category: 'meteor',   division: 4, min: 24.0, displayName: 'Meteor IV — The Orionid' },
    { tierId: 'meteor_3',   category: 'meteor',   division: 3, min: 30.0, displayName: 'Meteor III — The Leonid' },
    { tierId: 'meteor_2',   category: 'meteor',   division: 2, min: 35.0, displayName: 'Meteor II — The Geminid' },
    { tierId: 'meteor_1',   category: 'meteor',   division: 1, min: 39.0, displayName: 'Meteor I — The Perseid' },

    { tierId: 'asteroid_4', category: 'asteroid', division: 4, min: 42.0, displayName: 'Asteroid IV — The Hygiea' },
    { tierId: 'asteroid_3', category: 'asteroid', division: 3, min: 45.0, displayName: 'Asteroid III — The Pallas' },
    { tierId: 'asteroid_2', category: 'asteroid', division: 2, min: 47.0, displayName: 'Asteroid II — The Vesta' },
    { tierId: 'asteroid_1', category: 'asteroid', division: 1, min: 48.5, displayName: 'Asteroid I — The Ceres' },

    // ── THE ASCENT (Moon → Galaxy, v2/v3 floors) ──
    { tierId: 'moon_4',      category: 'moon',      division: 4, min: 50.0, displayName: 'Moon IV — The Deimos' },
    { tierId: 'moon_3',      category: 'moon',      division: 3, min: 53.0, displayName: 'Moon III — The Phobos' },
    { tierId: 'moon_2',      category: 'moon',      division: 2, min: 56.0, displayName: 'Moon II — The Europa' },
    { tierId: 'moon_1',      category: 'moon',      division: 1, min: 59.0, displayName: 'Moon I — The Titan' },

    { tierId: 'planet_4',    category: 'planet',    division: 4, min: 62.0, displayName: 'Planet IV — The Mercury' },
    { tierId: 'planet_3',    category: 'planet',    division: 3, min: 65.0, displayName: 'Planet III — The Mars' },
    { tierId: 'planet_2',    category: 'planet',    division: 2, min: 68.0, displayName: 'Planet II — The Neptune' },
    { tierId: 'planet_1',    category: 'planet',    division: 1, min: 71.0, displayName: 'Planet I — The Jupiter' },

    { tierId: 'star_4',      category: 'star',      division: 4, min: 74.0, displayName: 'Star IV — The Sirius' },
    { tierId: 'star_3',      category: 'star',      division: 3, min: 77.0, displayName: 'Star III — The Vega' },
    { tierId: 'star_2',      category: 'star',      division: 2, min: 80.0, displayName: 'Star II — The Arcturus' },
    { tierId: 'star_1',      category: 'star',      division: 1, min: 82.5, displayName: 'Star I — The Rigel' },

    { tierId: 'pulsar_4',    category: 'pulsar',    division: 4, min: 85.0, displayName: 'Pulsar IV — The B1919' },
    { tierId: 'pulsar_3',    category: 'pulsar',    division: 3, min: 87.0, displayName: 'Pulsar III — The Vela' },
    { tierId: 'pulsar_2',    category: 'pulsar',    division: 2, min: 89.0, displayName: 'Pulsar II — The Crab' },
    { tierId: 'pulsar_1',    category: 'pulsar',    division: 1, min: 91.0, displayName: 'Pulsar I — The Magnetar' },

    { tierId: 'supernova_4', category: 'supernova', division: 4, min: 93.0, displayName: 'Supernova IV — The 1987A' },
    { tierId: 'supernova_3', category: 'supernova', division: 3, min: 94.5, displayName: 'Supernova III — The Tycho' },
    { tierId: 'supernova_2', category: 'supernova', division: 2, min: 96.0, displayName: 'Supernova II — The Cassiopeia A' },
    { tierId: 'supernova_1', category: 'supernova', division: 1, min: 97.0, displayName: 'Supernova I — The Betelgeuse' },

    { tierId: 'galaxy_4',    category: 'galaxy',    division: 4, min: 98.0, displayName: 'Galaxy IV — The Sombrero' },
    { tierId: 'galaxy_3',    category: 'galaxy',    division: 3, min: 98.7, displayName: 'Galaxy III — The Whirlpool' },
    { tierId: 'galaxy_2',    category: 'galaxy',    division: 2, min: 99.3, displayName: 'Galaxy II — The Milky Way' },
    { tierId: 'galaxy_1',    category: 'galaxy',    division: 1, min: 99.7, displayName: 'Galaxy I — The Andromeda' },
];

// Off-ladder secret tier (assigned only by the season rollover worker).
const QUASAR = { tierId: 'quasar', category: 'quasar', division: 0, displayName: 'The Quasar' };

// Fast lookups
const BY_ID = Object.fromEntries([...LADDER, QUASAR].map((t) => [t.tierId, t]));
const INDEX_BY_ID = Object.fromEntries(LADDER.map((t, i) => [t.tierId, i]));

// ── Eligibility gates (anti-inflation, spec §6.6) ──────────────────────────
// A mentor must clear the gate's weighted-review (and season) bar to ENTER a
// category; below it, the displayed tier is capped at the gate's floor tier.
const GATES = {
    star:      { minWeightedReviews: 8,  floorTierId: 'planet_1' },
    pulsar:    { minWeightedReviews: 20, floorTierId: 'star_1'   },
    supernova: { minWeightedReviews: 20, floorTierId: 'star_1'   }, // shares the Pulsar+ bar
    galaxy:    { minWeightedReviews: 50, floorTierId: 'supernova_1', minSeasons: 1 },
};
const GATES_COUNT = Object.keys(GATES).length;

/** Clamp a numeric score into the valid ladder range. */
function clampScore(score) {
    if (!Number.isFinite(score)) return 0;
    return Math.max(0, Math.min(100, score));
}

/**
 * Raw absolute tier from score alone, ignoring gates (spec §6.6 table).
 * @param {number} score 0..100
 * @returns {object} ladder entry
 */
function rawTierFromScore(score) {
    const s = clampScore(score);
    // Walk from highest down; first whose min <= s wins.
    for (let i = LADDER.length - 1; i >= 0; i--) {
        if (s >= LADDER[i].min) return LADDER[i];
    }
    return LADDER[0];
}

/**
 * Apply eligibility gates: if the mentor hasn't earned enough weighted reviews
 * (or seasons) for the raw category, cap the displayed tier at the gate floor.
 *
 * Gates CASCADE: capping into a lower category can land on another gated
 * category, so we re-check until the displayed tier's category is one the
 * mentor actually qualifies for. Example: 5 weighted reviews at a Pulsar-region
 * score caps to Star I (Pulsar gate), but 5 < 8 also fails the Star gate, so it
 * cascades further down to Planet I.
 *
 * @param {object} rawTier            entry from rawTierFromScore
 * @param {object} ctx
 * @param {number} ctx.weightedReviews
 * @param {number} [ctx.seasonsPlayed=0]
 * @returns {{ tier:object, gated:boolean, gateReason:string }}
 */
function applyGates(rawTier, { weightedReviews = 0, seasonsPlayed = 0 } = {}) {
    let tier = rawTier;
    let gated = false;
    let gateReason = '';

    // Loop is bounded by the number of gated categories (at most a few hops).
    for (let guard = 0; guard < GATES_COUNT + 1; guard++) {
        const gate = GATES[tier.category];
        if (!gate) break;

        const lacksReviews = weightedReviews < gate.minWeightedReviews;
        const lacksSeasons = gate.minSeasons != null && seasonsPlayed < gate.minSeasons;
        if (!lacksReviews && !lacksSeasons) break;

        const floor = BY_ID[gate.floorTierId];
        // Only ever cap DOWN — never push a mentor above their current tier.
        if (INDEX_BY_ID[floor.tierId] >= INDEX_BY_ID[tier.tierId]) break;

        // Keep the reason from the FIRST (highest) gate the mentor failed — that
        // is the tier they were reaching for and the bar they need to clear.
        if (!gated) {
            gateReason = lacksReviews
                ? `needs ${gate.minWeightedReviews} weighted reviews for ${tier.category}`
                : `needs ${gate.minSeasons} full season(s) for ${tier.category}`;
        }
        gated = true;
        tier = floor; // re-evaluate the floor's own category gate next iteration
    }

    return { tier, gated, gateReason };
}

/**
 * Progress (0..1) from the bottom of the CURRENT tier toward the next tier.
 * Galaxy I (top of ladder) always returns 1.
 * @param {number} score
 * @param {object} tier  current (post-gate) ladder entry
 */
function progressToNext(score, tier) {
    const idx = INDEX_BY_ID[tier.tierId];
    if (idx == null) return 1;                 // quasar / unknown → maxed
    if (idx >= LADDER.length - 1) return 1;    // Galaxy I
    const cur  = LADDER[idx].min;
    const next = LADDER[idx + 1].min;
    const s = clampScore(score);
    if (next <= cur) return 1;
    return Math.max(0, Math.min(1, (s - cur) / (next - cur)));
}

/**
 * Rich progress for the UI (v2 §1.1). Three modes:
 *  - "max":      top tier reached (Galaxy I) → full bar, "Max tier reached".
 *  - "locked":   the NEXT tier is behind an eligibility gate the user hasn't
 *                cleared → bar reflects reviews earned toward the requirement.
 *  - "progress": normal climb WITHIN the current tier band toward the next tier.
 *
 * @param {number} score          0..100 CosmicScore
 * @param {object} displayTier    post-gate ladder entry the user is shown at
 * @param {object} ctx            { weightedReviews, seasonsPlayed }
 */
function tierProgress(score, displayTier, { weightedReviews = 0, seasonsPlayed = 0 } = {}) {
    const idx = INDEX_BY_ID[displayTier.tierId];
    if (idx == null || idx >= LADDER.length - 1) {
        return { mode: 'max', pct: 1, label: 'Max tier reached' };
    }
    const next = LADDER[idx + 1];
    const gate = GATES[next.category];

    // Is the NEXT tier gated for this user?
    if (gate) {
        const lacksReviews = weightedReviews < gate.minWeightedReviews;
        const lacksSeasons = gate.minSeasons != null && seasonsPlayed < gate.minSeasons;
        if (lacksReviews) {
            const remaining = Math.max(0, gate.minWeightedReviews - weightedReviews);
            return {
                mode: 'locked',
                pct: Math.min(1, weightedReviews / gate.minWeightedReviews),
                label: `Earn ${remaining} more weighted review${remaining === 1 ? '' : 's'} to unlock ${next.displayName}`,
            };
        }
        if (lacksSeasons) {
            return { mode: 'locked', pct: 0.999, label: `Complete 1 full season to unlock ${next.displayName}` };
        }
    }

    const pct = progressToNext(score, displayTier);
    return { mode: 'progress', pct, label: `${Math.round(pct * 100)}% to ${next.displayName}` };
}

/**
 * Full assignment: score (+ eligibility context) → display tier + metadata.
 * The single entry point the recompute worker / API uses.
 *
 * @param {number} score
 * @param {object} [ctx] { weightedReviews, seasonsPlayed }
 * @returns {object} { tierId, category, division, displayName, rawTierId,
 *                      gated, gateReason, progress, progressToNext }
 */
function assignTier(score, ctx = {}) {
    const raw = rawTierFromScore(score);
    const { tier, gated, gateReason } = applyGates(raw, ctx);
    const progress = tierProgress(score, tier, ctx);
    return {
        tierId: tier.tierId,
        category: tier.category,
        division: tier.division,
        displayName: tier.displayName,
        rawTierId: raw.tierId,
        gated,
        gateReason,
        progress,                          // { mode, pct, label }
        progressToNext: progress.pct,      // backward-compat scalar
    };
}

/** Build a full tier object forced to a specific tierId at the given score. */
function tierObjectFor(tierId, score, ctx = {}) {
    const t = BY_ID[tierId] || LADDER[0];
    const progress = tierProgress(score, t, ctx);
    return {
        tierId: t.tierId, category: t.category, division: t.division,
        displayName: t.displayName, rawTierId: rawTierFromScore(score).tierId,
        gated: false, gateReason: '',
        progress, progressToNext: progress.pct,
    };
}

// ── Hysteresis demotion buffer (v4 §3) ─────────────────────────────────────
const DEMOTE_BUFFER = 1.5;

/** Width of a tier's score band (top tier → up to 100). */
function bandWidth(tierId) {
    const i = INDEX_BY_ID[tierId];
    if (i == null) return 100;
    const floor = LADDER[i].min;
    const ceil = i + 1 < LADDER.length ? LADDER[i + 1].min : 100;
    return ceil - floor;
}
/** Demotion buffer: capped at half the band so narrow top bands still work. */
function bufferFor(tierId) { return Math.min(DEMOTE_BUFFER, 0.5 * bandWidth(tierId)); }

/**
 * Apply hysteresis (v4 §3): you don't lose a tier the instant you dip below its
 * floor — only when you fall a buffer below it. Promotion is immediate.
 * Pure tierId → tierId given the user's CURRENT (anchor) tier and live score.
 */
function resolveTier(currentTierId, score) {
    if (currentTierId === 'quasar') return 'quasar';        // legends are permanent
    const banded = rawTierFromScore(score).tierId;
    if (!currentTierId || INDEX_BY_ID[currentTierId] == null) return banded;
    if (banded === currentTierId) return currentTierId;
    if (INDEX_BY_ID[banded] > INDEX_BY_ID[currentTierId]) return banded; // promote now
    // potential demotion — only past the buffer
    const floor = BY_ID[currentTierId].min;
    if (score < floor - bufferFor(currentTierId)) return banded;
    return currentTierId;                                   // grace zone: stay
}

/**
 * Display tier with hysteresis + gates + direction. The single entry point the
 * on-read API uses: it anchors on the user's stored cosmic.tierId so sticky
 * boundaries work without a separate persistence pass.
 *
 * @returns assignTier-shaped object + { direction: 'up'|'down'|null }
 */
function resolveDisplayTier(score, currentTierId, ctx = {}) {
    const bandId = resolveTier(currentTierId, score);
    // Gate-cap the resolved band for Star+ eligibility (no gates below Moon).
    const capped = applyGates(BY_ID[bandId], ctx).tier;
    const obj = tierObjectFor(capped.tierId, score, ctx);
    let direction = null;
    if (currentTierId && INDEX_BY_ID[currentTierId] != null && INDEX_BY_ID[capped.tierId] != null) {
        const d = INDEX_BY_ID[capped.tierId] - INDEX_BY_ID[currentTierId];
        direction = d > 0 ? 'up' : d < 0 ? 'down' : null;
    }
    return { ...obj, direction };
}

/** Compare two tierIds by ladder height. >0 means `a` is higher than `b`. */
function compareTiers(a, b) {
    const ia = a === 'quasar' ? Infinity : (INDEX_BY_ID[a] ?? -1);
    const ib = b === 'quasar' ? Infinity : (INDEX_BY_ID[b] ?? -1);
    return ia - ib;
}

/** True when moving old→new crosses into a new CATEGORY (a "Liftoff" moment). */
function isCategoryPromotion(oldTierId, newTierId) {
    const o = BY_ID[oldTierId];
    const n = BY_ID[newTierId];
    if (!o || !n) return false;
    return compareTiers(newTierId, oldTierId) > 0 && o.category !== n.category;
}

/** Name-glow tier (v2 §8): only Supernova+ glow. Returns null below Supernova. */
function nameGlowFor(tierId) {
    const t = BY_ID[tierId];
    if (!t) return null;
    if (t.category === 'quasar') return 'quasar';
    if (t.category === 'galaxy') return 'galaxy';
    if (t.category === 'supernova') return 'supernova';
    return null;
}

/** Raise a stored peak tierId to the higher of (stored, current) by ladder. */
function higherTier(aTierId, bTierId) {
    return compareTiers(aTierId, bTierId) >= 0 ? aTierId : bTierId;
}

module.exports = {
    LADDER, QUASAR, GATES, BY_ID, TIER_ORDER: LADDER.map((t) => t.tierId).concat('quasar'),
    clampScore, rawTierFromScore, applyGates, progressToNext, tierProgress,
    assignTier, tierObjectFor, resolveTier, resolveDisplayTier, bufferFor, bandWidth,
    compareTiers, isCategoryPromotion, nameGlowFor, higherTier,
};
