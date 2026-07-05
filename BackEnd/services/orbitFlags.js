/**
 * orbitFlags.js — staged-rollout feature flags for the Orbit Engine (Part 8),
 * now backed by the runtime config store (Mission Control C1) so flips apply
 * live without a redeploy. Reads are synchronous against flagStore's in-memory
 * cache; env values are the defaults.
 *
 *   tier1 — streak + missions + Photons
 *   tier2 — Binary Star + Weekly Leagues
 *   tier3 — cosmetics + mastery + ritual
 */

const store = require("./flagStore");

/** Stable 0–99 bucket for a user id (deterministic across restarts/replicas). */
function bucketOf(userId) {
    let h = 0;
    for (const ch of String(userId || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return h % 100;
}

// Live snapshots from the store (cheap, cached).
function tiers() {
    return { tier1: store.get("ORBIT_TIER1"), tier2: store.get("ORBIT_TIER2"), tier3: store.get("ORBIT_TIER3") };
}
function rollout() {
    return { tier1: 100, tier2: store.get("ORBIT_TIER2_PCT"), tier3: store.get("ORBIT_TIER3_PCT") };
}

/**
 * tierEnabledFor — is `tier` live for this user? Master switch AND (percentage
 * cohort). Missing userId with a partial rollout → treated as not in cohort.
 */
function tierEnabledFor(tier, userId) {
    if (!tiers()[tier]) return false;
    const pct = rollout()[tier];
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

module.exports = { bucketOf, tierEnabledFor, flagsFor, tiers, rollout };
