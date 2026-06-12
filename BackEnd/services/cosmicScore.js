/**
 * cosmicScore.js — pure scoring math for the Cosmic Leaderboard.
 *
 * NO database access, NO side effects, NO I/O. Every export is a pure function
 * of its inputs so it can be unit-tested in isolation and reused by the
 * recompute worker, the leaderboard service, and the API.
 *
 * Implements spec §6.1–§6.5. The real 1-5 star rating is an INPUT only; nothing
 * here ever mutates a rating. Sentiment is additive and degrades gracefully:
 * when it is unavailable/disabled, its 0.16 weight is redistributed into the
 * rating term so the board still works (§6.5).
 *
 * See COSMIC_LEADERBOARD_IMPLEMENTATION_PLAN.md §4.
 */

// ── Tunable constants (spec §6) ────────────────────────────────────────────
const RECENCY_HALFLIFE_DAYS = 90;   // exp(-Δdays / 90) soft half-life
const REVIEWER_CAP_N        = 3;    // min(1, 3 / reviewsFromThisReviewer)
const PRIOR_MEAN            = 3.8;  // m — platform-wide mean rating (Bayesian prior)
const PRIOR_STRENGTH        = 5;    // C — prior strength (~5 virtual average reviews)
const SWAP_SATURATION       = 50;   // normSwaps saturates ~50 completed swaps
const ACTIVITY_DAYS_FULL    = 30;   // normActivity hits 1.0 at 30 active days

// Composite weights (sum = 1.0) — spec §6.5
const W = Object.freeze({
    rating:    0.62,
    sentiment: 0.16,
    swaps:     0.14,
    activity:  0.08,
});

const clamp01 = (x) => Math.max(0, Math.min(1, x));

/**
 * Per-review weight: recency × reviewerCap × completedSwapFactor (spec §6.1).
 *
 * @param {object} r
 * @param {number} r.ageDays                 days since the review was written
 * @param {number} r.reviewsFromThisReviewer total reviews this reviewer gave this mentor
 * @param {boolean} r.tiedToCompletedSwap    review is tied to a completed swap
 * @param {number} [r.weightMultiplier=1]    optional extra weight (e.g. Verified Voyager +10%)
 * @returns {number} weight >= 0 (0 means the review does not count)
 */
function reviewWeight({ ageDays, reviewsFromThisReviewer, tiedToCompletedSwap, weightMultiplier = 1 }) {
    if (!tiedToCompletedSwap) return 0;                       // no completed swap → doesn't count
    const recency      = Math.exp(-Math.max(0, ageDays) / RECENCY_HALFLIFE_DAYS);
    const reviewerCap  = Math.min(1, REVIEWER_CAP_N / Math.max(1, reviewsFromThisReviewer));
    return recency * reviewerCap * Math.max(0, weightMultiplier);
}

/**
 * Bayesian-weighted rating → normalized 0..1 (spec §6.2).
 * Prevents "5.0 from 1 review" abuse by pulling toward the prior mean.
 *
 * @param {Array<{rating:number, weight:number}>} weighted
 * @returns {{ bayesRating:number, normRating:number, sumW:number }}
 */
function bayesianRating(weighted) {
    let sumRW = 0, sumW = 0;
    for (const { rating, weight } of weighted) {
        sumRW += rating * weight;
        sumW  += weight;
    }
    const bayesRating = (PRIOR_STRENGTH * PRIOR_MEAN + sumRW) / (PRIOR_STRENGTH + sumW); // 1..5
    const normRating  = clamp01((bayesRating - 1) / 4);                                  // 0..1
    return { bayesRating, normRating, sumW };
}

/**
 * Weighted-mean sentiment → normalized 0..1 (spec §6.3).
 * Reviews with null/undefined sentiment are ignored (they simply don't vote);
 * if NOTHING has sentiment, returns available:false so the composite can
 * redistribute the weight to rating.
 *
 * @param {Array<{sentiment:(number|null), weight:number}>} weighted
 * @returns {{ normSentiment:number, available:boolean }}
 */
function sentimentScore(weighted) {
    let sumSW = 0, sumW = 0;
    for (const { sentiment, weight } of weighted) {
        if (sentiment == null || Number.isNaN(sentiment)) continue;  // uncomputed → skip
        sumSW += sentiment * weight;
        sumW  += weight;
    }
    if (sumW === 0) return { normSentiment: 0, available: false };
    const S = sumSW / sumW;                          // -1..+1
    return { normSentiment: clamp01((S + 1) / 2), available: true };
}

/** normSwaps — saturates ~50 completed swaps (spec §6.4). */
function normSwaps(completedSwaps) {
    const c = Math.max(0, completedSwaps);
    return clamp01(Math.log10(1 + c) / Math.log10(1 + SWAP_SATURATION));
}

/** normActivity — 1.0 at 30 active days this season (spec §6.4). */
function normActivity(activeDaysThisSeason) {
    return clamp01(Math.max(0, activeDaysThisSeason) / ACTIVITY_DAYS_FULL);
}

/**
 * Composite CosmicScore on 0..100 (spec §6.5).
 *
 * When sentiment is unavailable OR explicitly disabled, the 0.16 sentiment
 * weight is folded into the rating weight (→ 0.78) so the score never depends
 * on BERT and never errors.
 *
 * @param {object} parts
 * @param {number}  parts.normRating
 * @param {number}  parts.normSentiment
 * @param {boolean} parts.sentimentAvailable
 * @param {number}  parts.normSwaps
 * @param {number}  parts.normActivity
 * @param {boolean} [parts.sentimentEnabled=true]  global BERT feature flag
 * @returns {{ score:number, weights:object, sentimentUsed:boolean }}
 */
function compositeScore({
    normRating,
    normSentiment,
    sentimentAvailable,
    normSwaps: ns,
    normActivity: na,
    sentimentEnabled = true,
}) {
    const useSentiment = sentimentEnabled && sentimentAvailable;

    const weights = useSentiment
        ? W
        : { rating: W.rating + W.sentiment, sentiment: 0, swaps: W.swaps, activity: W.activity };

    const score = 100 * (
        weights.rating    * clamp01(normRating) +
        weights.sentiment * clamp01(normSentiment) +
        weights.swaps     * clamp01(ns) +
        weights.activity  * clamp01(na)
    );

    return {
        score: Math.max(0, Math.min(100, score)),
        weights,
        sentimentUsed: useSentiment,
    };
}

/**
 * Convenience end-to-end: raw per-review rows → final CosmicScore + parts.
 * The single entry point the worker/service calls; thin wrapper over the
 * pure pieces above so everything stays individually testable.
 *
 * @param {object} input
 * @param {Array<object>} input.reviews   each: { rating, sentiment?, ageDays,
 *                                         reviewsFromThisReviewer,
 *                                         tiedToCompletedSwap, weightMultiplier? }
 * @param {number}  input.completedSwaps
 * @param {number}  input.activeDaysThisSeason
 * @param {boolean} [input.sentimentEnabled=true]
 * @returns {object} full breakdown incl. score, weightedReviews, parts
 */
function computeCosmicScore({
    reviews = [],
    completedSwaps = 0,
    activeDaysThisSeason = 0,
    sentimentEnabled = true,
}) {
    const weighted = reviews.map((r) => ({
        rating: r.rating,
        sentiment: r.sentiment ?? null,
        weight: reviewWeight(r),
    }));
    const counted = weighted.filter((w) => w.weight > 0);

    const { bayesRating, normRating, sumW } = bayesianRating(counted);
    const { normSentiment, available }       = sentimentScore(counted);
    const ns = normSwaps(completedSwaps);
    const na = normActivity(activeDaysThisSeason);

    const { score, weights, sentimentUsed } = compositeScore({
        normRating,
        normSentiment,
        sentimentAvailable: available,
        normSwaps: ns,
        normActivity: na,
        sentimentEnabled,
    });

    return {
        score,
        weightedReviews: sumW,                 // Σ weights — drives eligibility gates (§6.6)
        countedReviews: counted.length,
        parts: { bayesRating, normRating, normSentiment, normSwaps: ns, normActivity: na },
        sentimentUsed,
        weights,
    };
}

module.exports = {
    // constants (exported for tests / tier engine reuse)
    RECENCY_HALFLIFE_DAYS, REVIEWER_CAP_N, PRIOR_MEAN, PRIOR_STRENGTH,
    SWAP_SATURATION, ACTIVITY_DAYS_FULL, WEIGHTS: W,
    // pure pieces
    clamp01, reviewWeight, bayesianRating, sentimentScore, normSwaps, normActivity,
    compositeScore, computeCosmicScore,
};
