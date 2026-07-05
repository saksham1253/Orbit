/**
 * photonLedger.js — write Photon flows + build the Gravimeter economy report
 * (Mission Control C6). `record()` is fire-and-forget (never throws into the
 * request path). `aggregate()` is PURE over a list of events so it's unit-
 * testable; `report()` is the DB wrapper.
 */

const PhotonLedger = require("../models/PhotonLedger");

/** Append one flow. Best-effort. delta>0 earn, delta<0 spend. */
function record(userId, delta, source) {
    if (!userId || !delta) return;
    PhotonLedger.create({ userId, delta, source: source || "unknown" }).catch(() => {});
}

/**
 * aggregate — PURE. Reconcile a list of {userId, delta, source} into an economy
 * snapshot: sources vs sinks, net supply, top earners/spenders, inflation flag.
 * @param {Array} events
 * @param {object} [opts] { inflationRatio=3 } → alert when earned > spent*ratio
 */
function aggregate(events = [], { inflationRatio = 3 } = {}) {
    const sources = {}, sinks = {}, earnBy = {}, spendBy = {};
    let totalEarned = 0, totalSpent = 0;

    for (const e of events) {
        const uid = String(e.userId);
        if (e.delta > 0) {
            sources[e.source] = (sources[e.source] || 0) + e.delta;
            earnBy[uid] = (earnBy[uid] || 0) + e.delta;
            totalEarned += e.delta;
        } else if (e.delta < 0) {
            const abs = -e.delta;
            sinks[e.source] = (sinks[e.source] || 0) + abs;
            spendBy[uid] = (spendBy[uid] || 0) + abs;
            totalSpent += abs;
        }
    }

    const top = (obj) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([userId, amount]) => ({ userId, amount }));
    const netSupply = totalEarned - totalSpent;
    // Inflation: Photons entering far faster than they leave → rewards devalue.
    const inflationAlert = totalEarned > 0 && (totalSpent === 0 || totalEarned > totalSpent * inflationRatio);

    return {
        sources, sinks,
        totalEarned, totalSpent, netSupply,
        sinkRatio: totalEarned ? Math.round((totalSpent / totalEarned) * 100) / 100 : 0,
        topEarners: top(earnBy), topSpenders: top(spendBy),
        inflationAlert, events: events.length,
    };
}

/** DB report over an optional time window. */
async function report({ from, to } = {}) {
    const q = {};
    if (from || to) { q.createdAt = {}; if (from) q.createdAt.$gte = new Date(from); if (to) q.createdAt.$lte = new Date(to); }
    const events = await PhotonLedger.find(q).select("userId delta source").lean();
    return aggregate(events);
}

module.exports = { record, aggregate, report };
