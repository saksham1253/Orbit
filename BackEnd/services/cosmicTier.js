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

// ── Canonical tier ladder (spec §5) ────────────────────────────────────────
// Order matters: index 0 = lowest (Moon IV) … index 23 = highest (Galaxy I).
// `min` is the inclusive lower bound on the 0..100 CosmicScore (spec §6.6).
// Quasar is OFF-ladder (retired #1 champions only) and is not in this array.
const LADDER = [
    { tierId: 'moon_4',      category: 'moon',      division: 4, min: 0,    emoji: '🌑', displayName: 'Moon IV — The Deimos' },
    { tierId: 'moon_3',      category: 'moon',      division: 3, min: 6,    emoji: '🌑', displayName: 'Moon III — The Phobos' },
    { tierId: 'moon_2',      category: 'moon',      division: 2, min: 12,   emoji: '🌑', displayName: 'Moon II — The Europa' },
    { tierId: 'moon_1',      category: 'moon',      division: 1, min: 18,   emoji: '🌑', displayName: 'Moon I — The Titan' },

    { tierId: 'planet_4',    category: 'planet',    division: 4, min: 24,   emoji: '🪐', displayName: 'Planet IV — The Mercury' },
    { tierId: 'planet_3',    category: 'planet',    division: 3, min: 30,   emoji: '🪐', displayName: 'Planet III — The Mars' },
    { tierId: 'planet_2',    category: 'planet',    division: 2, min: 36,   emoji: '🪐', displayName: 'Planet II — The Neptune' },
    { tierId: 'planet_1',    category: 'planet',    division: 1, min: 42,   emoji: '🪐', displayName: 'Planet I — The Jupiter' },

    { tierId: 'star_4',      category: 'star',      division: 4, min: 48,   emoji: '☀️', displayName: 'Star IV — The Sirius' },
    { tierId: 'star_3',      category: 'star',      division: 3, min: 54,   emoji: '☀️', displayName: 'Star III — The Vega' },
    { tierId: 'star_2',      category: 'star',      division: 2, min: 60,   emoji: '☀️', displayName: 'Star II — The Arcturus' },
    { tierId: 'star_1',      category: 'star',      division: 1, min: 66,   emoji: '☀️', displayName: 'Star I — The Rigel' },

    { tierId: 'pulsar_4',    category: 'pulsar',    division: 4, min: 71,   emoji: '💫', displayName: 'Pulsar IV — The B1919' },
    { tierId: 'pulsar_3',    category: 'pulsar',    division: 3, min: 76,   emoji: '💫', displayName: 'Pulsar III — The Vela' },
    { tierId: 'pulsar_2',    category: 'pulsar',    division: 2, min: 81,   emoji: '💫', displayName: 'Pulsar II — The Crab' },
    { tierId: 'pulsar_1',    category: 'pulsar',    division: 1, min: 85,   emoji: '💫', displayName: 'Pulsar I — The Magnetar' },

    { tierId: 'supernova_4', category: 'supernova', division: 4, min: 89,   emoji: '💥', displayName: 'Supernova IV — The 1987A' },
    { tierId: 'supernova_3', category: 'supernova', division: 3, min: 92,   emoji: '💥', displayName: 'Supernova III — The Tycho' },
    { tierId: 'supernova_2', category: 'supernova', division: 2, min: 94,   emoji: '💥', displayName: 'Supernova II — The Cassiopeia A' },
    { tierId: 'supernova_1', category: 'supernova', division: 1, min: 96,   emoji: '💥', displayName: 'Supernova I — The Betelgeuse' },

    { tierId: 'galaxy_4',    category: 'galaxy',    division: 4, min: 97.5, emoji: '🌌', displayName: 'Galaxy IV — The Sombrero' },
    { tierId: 'galaxy_3',    category: 'galaxy',    division: 3, min: 98.4, emoji: '🌌', displayName: 'Galaxy III — The Whirlpool' },
    { tierId: 'galaxy_2',    category: 'galaxy',    division: 2, min: 99.1, emoji: '🌌', displayName: 'Galaxy II — The Milky Way' },
    { tierId: 'galaxy_1',    category: 'galaxy',    division: 1, min: 99.6, emoji: '🌌', displayName: 'Galaxy I — The Andromeda' },
];

// Off-ladder secret tier (assigned only by the season rollover worker).
const QUASAR = { tierId: 'quasar', category: 'quasar', division: 0, emoji: '🌠', displayName: 'The Quasar' };

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
 * Full assignment: score (+ eligibility context) → display tier + metadata.
 * The single entry point the recompute worker / API uses.
 *
 * @param {number} score
 * @param {object} [ctx] { weightedReviews, seasonsPlayed }
 * @returns {object} { tierId, category, division, displayName, emoji,
 *                      rawTierId, gated, gateReason, progressToNext }
 */
function assignTier(score, ctx = {}) {
    const raw = rawTierFromScore(score);
    const { tier, gated, gateReason } = applyGates(raw, ctx);
    return {
        tierId: tier.tierId,
        category: tier.category,
        division: tier.division,
        displayName: tier.displayName,
        emoji: tier.emoji,
        rawTierId: raw.tierId,
        gated,
        gateReason,
        progressToNext: progressToNext(score, tier),
    };
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

module.exports = {
    LADDER, QUASAR, GATES, BY_ID,
    clampScore, rawTierFromScore, applyGates, progressToNext,
    assignTier, compareTiers, isCategoryPromotion,
};
