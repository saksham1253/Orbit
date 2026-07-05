/**
 * orbitFlags.js — staged-rollout feature flags for the Orbit Engine (Part 8).
 *
 * Each tier can be switched off entirely OR rolled out to a deterministic
 * percentage cohort, so the social/competitive tiers (the highest wellbeing
 * risk) can be observed in isolation before full release. Pure + env-driven;
 * defaults keep every tier fully ON so existing behavior is unchanged.
 *
 *   tier1 — streak + missions + Photons
 *   tier2 — Binary Star + Weekly Leagues
 *   tier3 — cosmetics + mastery + ritual
 */

const bool = (v, d) => (v == null ? d : String(v).toLowerCase() !== "false");
const int = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; };

// Master on/off per tier.
const TIERS = Object.freeze({
    tier1: bool(process.env.ORBIT_TIER1, true),
    tier2: bool(process.env.ORBIT_TIER2, true),
    tier3: bool(process.env.ORBIT_TIER3, true),
});

// Percentage rollout per tier (0–100). 100 = everyone; 0 = nobody.
const ROLLOUT = Object.freeze({
    tier1: int(process.env.ORBIT_TIER1_PCT, 100),
    tier2: int(process.env.ORBIT_TIER2_PCT, 100),
    tier3: int(process.env.ORBIT_TIER3_PCT, 100),
});

/** Stable 0–99 bucket for a user id (deterministic across restarts/replicas). */
function bucketOf(userId) {
    let h = 0;
    for (const ch of String(userId || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return h % 100;
}

/**
 * tierEnabledFor — is `tier` live for this user? Master switch AND (percentage
 * cohort). Missing userId with a partial rollout → treated as not in cohort.
 */
function tierEnabledFor(tier, userId) {
    if (!TIERS[tier]) return false;
    const pct = ROLLOUT[tier];
    if (pct >= 100) return true;
    if (pct <= 0) return false;
    if (userId == null) return false;
    return bucketOf(userId) < pct;
}

/** Snapshot of which tiers are live for a user (exposed to the client UI). */
function flagsFor(userId) {
    return {
        tier1: tierEnabledFor("tier1", userId),
        tier2: tierEnabledFor("tier2", userId),
        tier3: tierEnabledFor("tier3", userId),
    };
}

module.exports = { TIERS, ROLLOUT, bucketOf, tierEnabledFor, flagsFor };
