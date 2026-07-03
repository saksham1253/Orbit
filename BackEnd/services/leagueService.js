/**
 * leagueService.js — Weekly League math (Orbit Engine, Tier 2b).
 *
 * Cosmic-themed promotion/relegation ladder driven by FRESH weekly Orbit XP
 * (earned from real actions, reset every ISO week). The pure helpers here own
 * the division ladder, XP values, per-group promote/relegate zoning, and the
 * balanced re-grouping used by the weekly rollover worker. No I/O, no Date.now().
 *
 * Ranking within a group is this week's XP only, so newcomers can win regardless
 * of CosmicScore — but GROUPS are seeded by CosmicScore similarity so each week
 * is "winnable" (you compete with peers, not the whole platform).
 */

// ── Division ladder (low → high) ─────────────────────────────────────────────
const DIVISIONS = Object.freeze([
    { id: "asteroid_belt", name: "Asteroid Belt", color: "#9ca3af" },
    { id: "comet_run",     name: "Comet Run",     color: "#7dd3fc" },
    { id: "nebula",        name: "Nebula",        color: "#c084fc" },
    { id: "star_cluster",  name: "Star Cluster",  color: "#fcd34d" },
    { id: "galaxy",        name: "Galaxy",        color: "#f472b6" },
    { id: "supercluster",  name: "Supercluster",  color: "#f59e0b" },
]);
const DIVISION_IDS = DIVISIONS.map((d) => d.id);

// ── Tunables ─────────────────────────────────────────────────────────────────
const GROUP_SIZE      = 30;   // target members per league group
const PROMOTE_COUNT   = 5;    // top N of a group promote
const RELEGATE_COUNT  = 5;    // bottom N of a group relegate (lowest division exempt)

// XP per real action (weekly, resets Monday). Sourced from orbitConfig so the
// weights are a single, env-tunable source of truth (Part 2). `rating` is the
// metric key for a review.
const { XP: XP_CFG } = require("./orbitConfig");
const XP = Object.freeze({ swap: XP_CFG.swap, rating: XP_CFG.review, message: XP_CFG.message });
const XP_MISSION_CLAIM = XP_CFG.missionClaim;  // bonus when a weekly mission is claimed
const XP_MILESTONE     = XP_CFG.milestone;     // bonus when a personal streak milestone is reached

const clampIdx = (i) => Math.max(0, Math.min(DIVISION_IDS.length - 1, i));
const divisionIndex = (id) => {
    const i = DIVISION_IDS.indexOf(id);
    return i < 0 ? 0 : i;
};
const divisionMeta = (id) => DIVISIONS[divisionIndex(id)];
const promoteDivision  = (id) => DIVISION_IDS[clampIdx(divisionIndex(id) + 1)];
const relegateDivision = (id) => DIVISION_IDS[clampIdx(divisionIndex(id) - 1)];
const higherDivision   = (a, b) => (divisionIndex(a) >= divisionIndex(b) ? a : b);

/** XP for a real-progress action metric (0 for unknown). */
function xpFor(metric) {
    return XP[metric] || 0;
}

/**
 * zoneFor — where a rank sits in a group of `size`: 'promote' | 'hold' |
 * 'relegate'. The lowest division never relegates; the highest never promotes.
 * Guards tiny groups so promote/relegate zones never overlap.
 *
 * @param {number} rank 1-based
 * @param {number} size group size
 * @param {string} divisionId
 */
function zoneFor(rank, size, divisionId) {
    const isTop = divisionIndex(divisionId) === DIVISION_IDS.length - 1;
    const isBottom = divisionIndex(divisionId) === 0;
    const promoteCut = isTop ? 0 : Math.min(PROMOTE_COUNT, Math.floor(size / 2));
    const relegateCut = isBottom ? 0 : Math.min(RELEGATE_COUNT, size - promoteCut);
    if (rank <= promoteCut) return "promote";
    if (rank > size - relegateCut) return "relegate";
    return "hold";
}

/**
 * standings — rank a group's members by weekly XP (desc) and tag each with its
 * zone. Deterministic tiebreak: xp → highestDivision → userId.
 *
 * @param {Array<{userId, name?, avatar?, weekXp, divisionId, highestDivisionId?}>} members
 * @param {string} divisionId
 * @returns {Array} members + { rank, zone }
 */
function standings(members, divisionId) {
    const sorted = [...members].sort(
        (a, b) =>
            (b.weekXp || 0) - (a.weekXp || 0) ||
            divisionIndex(b.highestDivisionId || b.divisionId) - divisionIndex(a.highestDivisionId || a.divisionId) ||
            String(a.userId).localeCompare(String(b.userId))
    );
    const size = sorted.length;
    return sorted.map((m, i) => ({ ...m, rank: i + 1, zone: zoneFor(i + 1, size, divisionId) }));
}

/**
 * applyRollover — given ONE ended group's members, compute each member's NEXT
 * division + result label. Pure; the worker persists the outcome.
 *
 * @returns {Array<{userId, nextDivisionId, result}>}  result ∈ promoted|relegated|held
 */
function applyRollover(members, divisionId) {
    return standings(members, divisionId).map((m) => {
        let nextDivisionId = divisionId, result = "held";
        if (m.zone === "promote") { nextDivisionId = promoteDivision(divisionId); result = "promoted"; }
        else if (m.zone === "relegate") { nextDivisionId = relegateDivision(divisionId); result = "relegated"; }
        // Edge divisions can't move → stays held even if zoned.
        if (nextDivisionId === divisionId) result = "held";
        return { userId: m.userId, nextDivisionId, result };
    });
}

/**
 * rebuildGroups — chunk a division's members into balanced groups of GROUP_SIZE,
 * seeded by CosmicScore similarity (caller passes members already sorted by
 * cosmic score desc). Returns groupId assignments for the given week.
 *
 * @param {Array<{userId}>} sortedMembers  sorted by cosmic score desc
 * @param {string} divisionId
 * @param {string} weekId
 * @returns {Array<{userId, groupId, index}>}
 */
function rebuildGroups(sortedMembers, divisionId, weekId) {
    const out = [];
    for (let i = 0; i < sortedMembers.length; i++) {
        const groupIndex = Math.floor(i / GROUP_SIZE);
        out.push({
            userId: sortedMembers[i].userId,
            groupId: `${divisionId}:${weekId}:${groupIndex}`,
            index: groupIndex,
        });
    }
    return out;
}

module.exports = {
    DIVISIONS, DIVISION_IDS, GROUP_SIZE, PROMOTE_COUNT, RELEGATE_COUNT,
    XP, XP_MISSION_CLAIM, XP_MILESTONE,
    divisionIndex, divisionMeta, promoteDivision, relegateDivision, higherDivision,
    xpFor, zoneFor, standings, applyRollover, rebuildGroups,
};
