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

// ── Tunable constants (spec §6 + v2 §2) ────────────────────────────────────
const RECENCY_HALFLIFE_DAYS = 90;   // exp(-Δdays / 90) soft half-life
const REVIEWER_CAP_N        = 3;    // min(1, 3 / reviewsFromThisReviewer)
const PRIOR_MEAN            = 3.8;  // m — platform-wide mean rating (Bayesian prior)
const PRIOR_STRENGTH        = 5;    // C — prior strength (~5 virtual average reviews)
const SWAP_SATURATION       = 50;   // normSwaps saturates ~50 completed swaps
const ACTIVITY_DAYS_FULL    = 30;   // normActivity hits 1.0 at 30 active days

// v2 §2 / v4 §1 — warm start + symmetric confidence ramp.
//   - brand-new users start at exactly WARM_START (50 = Moon IV)
//   - the score can now fall to SCORE_FLOOR (0) when real poor reviews
//     accumulate (The Descent), and rise to 100
//   - confidence damps deviation from 50 in BOTH directions, so newcomers
//     and noise don't swing wildly
const WARM_START              = 50;  // brand-new mentor score (Moon IV)
const SCORE_FLOOR             = 0;   // v4: scores can descend below Moon to 0
const NEUTRAL                 = 0.50;// a composite of 0.50 is "average" → 50
const MIN_REVIEWS_FOR_RANKING = 1;   // below this → pure warm start
const FULL_CONFIDENCE_REVIEWS = 10;  // confidence = min(1, n / 10)

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
 * Composite01 — the 0..1 blend of the four normalized components (v2 §2.1).
 * When sentiment is unavailable OR explicitly disabled, the 0.16 sentiment
 * weight is folded into the rating weight (→ 0.78) so the score never depends
 * on BERT and never errors.
 *
 * @returns {{ composite01:number, weights:object, sentimentUsed:boolean }}
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

    const composite01 = clamp01(
        weights.rating    * clamp01(normRating) +
        weights.sentiment * clamp01(normSentiment) +
        weights.swaps     * clamp01(ns) +
        weights.activity  * clamp01(na)
    );

    return { composite01, weights, sentimentUsed: useSentiment };
}

/**
 * Map a 0..1 composite into a 0..100 score, hinged at NEUTRAL→50 and damped by
 * a confidence ramp so few reviews stay near 50 (v4 §1, symmetric).
 *
 *   c >= 0.5 → raw = 50 + 50·(c−0.5)/0.5      (climb, 50..100)
 *   c <  0.5 → raw = 50·(c/0.5)               (descend, 0..50)
 *   score = 50 + (raw − 50)·confidence,  confidence = min(1, n/10)
 *
 * Brand-new users (below MIN_REVIEWS_FOR_RANKING weighted reviews) get exactly
 * WARM_START (50 = Moon IV) — they can never be a Descent tier on day one.
 * Result is clamped to [SCORE_FLOOR, 100].
 */
function rebaseScore(composite01, weightedReviews) {
    if (weightedReviews < MIN_REVIEWS_FOR_RANKING) return WARM_START;
    const c = clamp01(composite01);
    const raw = c >= NEUTRAL
        ? 50 + 50 * (c - NEUTRAL) / (1 - NEUTRAL)
        : 50 * (c / NEUTRAL);
    const confidence = Math.min(1, weightedReviews / FULL_CONFIDENCE_REVIEWS);
    const score = 50 + (raw - 50) * confidence;
    return Math.min(100, Math.max(SCORE_FLOOR, score));
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

    const { composite01, weights, sentimentUsed } = compositeScore({
        normRating,
        normSentiment,
        sentimentAvailable: available,
        normSwaps: ns,
        normActivity: na,
        sentimentEnabled,
    });

    // v2 §2.1 — warm-start floor + confidence ramp.
    const score = rebaseScore(composite01, sumW);
    const confidence = Math.min(1, sumW / FULL_CONFIDENCE_REVIEWS);

    return {
        score,                                 // 50..100 (warm start)
        weightedReviews: sumW,                 // Σ weights — drives eligibility gates (§6.6)
        countedReviews: counted.length,
        confidence,
        composite01,
        parts: { bayesRating, normRating, normSentiment, normSwaps: ns, normActivity: na },
        sentimentUsed,
        weights,
    };
}

module.exports = {
    // constants (exported for tests / tier engine reuse)
    RECENCY_HALFLIFE_DAYS, REVIEWER_CAP_N, PRIOR_MEAN, PRIOR_STRENGTH,
    SWAP_SATURATION, ACTIVITY_DAYS_FULL, WEIGHTS: W,
    WARM_START, SCORE_FLOOR, NEUTRAL, FLOOR: WARM_START, MIN_REVIEWS_FOR_RANKING, FULL_CONFIDENCE_REVIEWS,
    // pure pieces
    clamp01, reviewWeight, bayesianRating, sentimentScore, normSwaps, normActivity,
    compositeScore, rebaseScore, computeCosmicScore,
};
