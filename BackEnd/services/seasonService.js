/**
 * seasonService.js — season helpers + anti-gaming guards (spec §15).
 *
 * Seasons are monthly ("YYYY-MM"). Tier/division are absolute and persistent;
 * only the competitive RANK + activity reset each season. peakTierId is always
 * retained. Pure-ish helpers here; the scheduled rollover lives in
 * workers/seasonWorker.js.
 */

const Rating = require("../models/rating");

/** Season id for a given date (UTC), e.g. "2026-06". */
function seasonIdFor(date = new Date()) {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
}

/** Start/end (UTC) of the month containing `date`. */
function seasonBounds(date = new Date()) {
    const startsAt = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0));
    const endsAt = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 0, 0, 0));
    return { startsAt, endsAt };
}

// ── Anti-gaming: review-ring detection (spec §15.2) ────────────────────────
/**
 * Detect reciprocal / cyclic review clusters among a set of reviews and return
 * the set of edge ids ("from→to") that should be DISCOUNTED. Pure function over
 * an edge list so it is unit-testable and side-effect free.
 *
 *   - reciprocal: A→B and B→A  → discount both
 *   - 3-cycles:   A→B→C→A      → discount the cycle edges
 *
 * @param {Array<{from:string,to:string}>} edges
 * @returns {Set<string>} keys `${from}->${to}` to discount
 */
function detectReviewRings(edges) {
    const flagged = new Set();
    const has = new Set(edges.map((e) => `${e.from}->${e.to}`));

    // Reciprocal pairs.
    for (const e of edges) {
        if (has.has(`${e.to}->${e.from}`)) {
            flagged.add(`${e.from}->${e.to}`);
            flagged.add(`${e.to}->${e.from}`);
        }
    }

    // 3-cycles A→B→C→A.
    const out = new Map();
    for (const e of edges) {
        if (!out.has(e.from)) out.set(e.from, []);
        out.get(e.from).push(e.to);
    }
    for (const a of out.keys()) {
        for (const b of out.get(a) || []) {
            for (const c of out.get(b) || []) {
                if (c === a) continue;
                if ((out.get(c) || []).includes(a)) {
                    flagged.add(`${a}->${b}`);
                    flagged.add(`${b}->${c}`);
                    flagged.add(`${c}->${a}`);
                }
            }
        }
    }
    return flagged;
}

// ── Anti-gaming: velocity guard (spec §15.2) ───────────────────────────────
/**
 * Flag a suspicious spike: many reviews from few distinct reviewers in a short
 * window. Pure function → testable.
 * @returns {{ throttle:boolean, reason:string }}
 */
function velocityGuard({ reviewsLast24h = 0, distinctReviewers24h = 0 } = {}) {
    if (reviewsLast24h >= 8 && distinctReviewers24h <= 2) {
        return { throttle: true, reason: "many reviews from very few reviewers in 24h" };
    }
    return { throttle: false, reason: "" };
}

/**
 * Build the discounted-edge set for one mentor by scanning the reviews they
 * gave/received plus their reviewers' outgoing reviews (enough to catch
 * reciprocal + small cycles cheaply). DB-backed convenience wrapper.
 */
async function ringDiscountFor(mentorId) {
    const received = await Rating.find({ toUser: mentorId }).select("fromUser toUser").lean();
    const reviewerIds = received.map((r) => r.fromUser);
    // Edges among the mentor + their reviewers (covers reciprocal + 3-cycles).
    const related = await Rating.find({
        $or: [{ fromUser: { $in: reviewerIds } }, { toUser: { $in: reviewerIds } }],
    }).select("fromUser toUser").lean();

    const edges = related.map((r) => ({ from: String(r.fromUser), to: String(r.toUser) }));
    return detectReviewRings(edges);
}

module.exports = {
    seasonIdFor, seasonBounds,
    detectReviewRings, velocityGuard, ringDiscountFor,
};
