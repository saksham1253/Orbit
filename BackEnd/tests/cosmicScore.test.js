const {
    reviewWeight,
    bayesianRating,
    sentimentScore,
    normSwaps,
    normActivity,
    compositeScore,
    computeCosmicScore,
    PRIOR_MEAN,
    PRIOR_STRENGTH,
    WEIGHTS,
} = require('../services/cosmicScore');

describe('cosmicScore — reviewWeight (§6.1)', () => {
    it('returns 0 when the review is not tied to a completed swap', () => {
        const w = reviewWeight({ ageDays: 0, reviewsFromThisReviewer: 1, tiedToCompletedSwap: false });
        expect(w).toBe(0);
    });

    it('is ~1.0 for a fresh, single, completed-swap review', () => {
        const w = reviewWeight({ ageDays: 0, reviewsFromThisReviewer: 1, tiedToCompletedSwap: true });
        expect(w).toBeCloseTo(1.0, 5);
    });

    it('decays with age via the 90-day half-life', () => {
        const fresh = reviewWeight({ ageDays: 0,  reviewsFromThisReviewer: 1, tiedToCompletedSwap: true });
        const old   = reviewWeight({ ageDays: 90, reviewsFromThisReviewer: 1, tiedToCompletedSwap: true });
        expect(old).toBeLessThan(fresh);
        expect(old).toBeCloseTo(Math.exp(-1), 5); // e^-1 at one half-life
    });

    it('caps a single reviewer who reviews many times (min(1, 3/n))', () => {
        const once  = reviewWeight({ ageDays: 0, reviewsFromThisReviewer: 1, tiedToCompletedSwap: true });
        const sixth = reviewWeight({ ageDays: 0, reviewsFromThisReviewer: 6, tiedToCompletedSwap: true });
        expect(once).toBe(1);
        expect(sixth).toBeCloseTo(0.5, 5); // 3/6
    });

    it('applies the optional weightMultiplier (e.g. Verified Voyager +10%)', () => {
        const w = reviewWeight({ ageDays: 0, reviewsFromThisReviewer: 1, tiedToCompletedSwap: true, weightMultiplier: 1.1 });
        expect(w).toBeCloseTo(1.1, 5);
    });
});

describe('cosmicScore — bayesianRating (§6.2)', () => {
    it('with no reviews returns the prior mean', () => {
        const { bayesRating, normRating, sumW } = bayesianRating([]);
        expect(bayesRating).toBeCloseTo(PRIOR_MEAN, 5);
        expect(sumW).toBe(0);
        expect(normRating).toBeCloseTo((PRIOR_MEAN - 1) / 4, 5);
    });

    it('pulls a single 5-star review toward the prior (no instant 5.0)', () => {
        const { bayesRating } = bayesianRating([{ rating: 5, weight: 1 }]);
        // (5*3.8 + 5*1) / (5 + 1) = 24/6 = 4.0
        expect(bayesRating).toBeCloseTo(4.0, 5);
        expect(bayesRating).toBeLessThan(5);
    });

    it('approaches the true mean as weighted volume grows', () => {
        const many = Array.from({ length: 100 }, () => ({ rating: 5, weight: 1 }));
        const { bayesRating } = bayesianRating(many);
        expect(bayesRating).toBeGreaterThan(4.9);
    });

    it('normRating is clamped to 0..1', () => {
        const { normRating } = bayesianRating([{ rating: 5, weight: 1000 }]);
        expect(normRating).toBeLessThanOrEqual(1);
        expect(normRating).toBeGreaterThanOrEqual(0);
    });
});

describe('cosmicScore — sentimentScore (§6.3)', () => {
    it('reports unavailable when nothing has sentiment', () => {
        const { available, normSentiment } = sentimentScore([
            { sentiment: null, weight: 1 },
            { sentiment: null, weight: 2 },
        ]);
        expect(available).toBe(false);
        expect(normSentiment).toBe(0);
    });

    it('maps -1..+1 onto 0..1', () => {
        expect(sentimentScore([{ sentiment: 1,  weight: 1 }]).normSentiment).toBeCloseTo(1, 5);
        expect(sentimentScore([{ sentiment: -1, weight: 1 }]).normSentiment).toBeCloseTo(0, 5);
        expect(sentimentScore([{ sentiment: 0,  weight: 1 }]).normSentiment).toBeCloseTo(0.5, 5);
    });

    it('ignores null entries but still uses the computed ones', () => {
        const { available, normSentiment } = sentimentScore([
            { sentiment: null, weight: 5 },
            { sentiment: 1, weight: 1 },
        ]);
        expect(available).toBe(true);
        expect(normSentiment).toBeCloseTo(1, 5);
    });
});

describe('cosmicScore — normSwaps / normActivity (§6.4)', () => {
    it('normSwaps is 0 at zero swaps and ~1 at the saturation point', () => {
        expect(normSwaps(0)).toBeCloseTo(0, 5);
        expect(normSwaps(50)).toBeCloseTo(1, 5);
        expect(normSwaps(500)).toBe(1); // clamped
    });

    it('normActivity hits 1.0 at 30 days and clamps beyond', () => {
        expect(normActivity(0)).toBe(0);
        expect(normActivity(15)).toBeCloseTo(0.5, 5);
        expect(normActivity(30)).toBe(1);
        expect(normActivity(60)).toBe(1);
    });
});

describe('cosmicScore — compositeScore (§6.5)', () => {
    it('a perfect mentor scores 100', () => {
        const { score } = compositeScore({
            normRating: 1, normSentiment: 1, sentimentAvailable: true,
            normSwaps: 1, normActivity: 1,
        });
        expect(score).toBeCloseTo(100, 5);
    });

    it('uses the documented weights when sentiment is available', () => {
        const { score, sentimentUsed, weights } = compositeScore({
            normRating: 1, normSentiment: 0, sentimentAvailable: true,
            normSwaps: 0, normActivity: 0,
        });
        expect(sentimentUsed).toBe(true);
        expect(weights.rating).toBeCloseTo(WEIGHTS.rating, 5);
        expect(score).toBeCloseTo(62, 5);
    });

    it('redistributes the 0.16 sentiment weight into rating when unavailable (§6.5 fallback)', () => {
        const { score, sentimentUsed, weights } = compositeScore({
            normRating: 1, normSentiment: 0, sentimentAvailable: false,
            normSwaps: 0, normActivity: 0,
        });
        expect(sentimentUsed).toBe(false);
        expect(weights.rating).toBeCloseTo(0.78, 5);
        expect(weights.sentiment).toBe(0);
        expect(score).toBeCloseTo(78, 5);
    });

    it('respects the global sentimentEnabled=false flag even if data exists', () => {
        const { sentimentUsed, weights } = compositeScore({
            normRating: 1, normSentiment: 1, sentimentAvailable: true,
            normSwaps: 0, normActivity: 0, sentimentEnabled: false,
        });
        expect(sentimentUsed).toBe(false);
        expect(weights.rating).toBeCloseTo(0.78, 5);
    });

    it('never returns a score outside 0..100', () => {
        const hi = compositeScore({ normRating: 5, normSentiment: 5, sentimentAvailable: true, normSwaps: 5, normActivity: 5 });
        const lo = compositeScore({ normRating: -5, normSentiment: -5, sentimentAvailable: true, normSwaps: -5, normActivity: -5 });
        expect(hi.score).toBeLessThanOrEqual(100);
        expect(lo.score).toBeGreaterThanOrEqual(0);
    });
});

describe('cosmicScore — computeCosmicScore (end-to-end)', () => {
    it('a brand-new user with no reviews gets a low, finite score', () => {
        const out = computeCosmicScore({ reviews: [], completedSwaps: 0, activeDaysThisSeason: 0 });
        expect(out.score).toBeGreaterThanOrEqual(0);
        expect(out.score).toBeLessThan(60);
        expect(out.weightedReviews).toBe(0);
        expect(Number.isFinite(out.score)).toBe(true);
    });

    it('excludes non-completed-swap reviews from the weighted count', () => {
        const out = computeCosmicScore({
            reviews: [
                { rating: 5, ageDays: 0, reviewsFromThisReviewer: 1, tiedToCompletedSwap: false },
                { rating: 5, ageDays: 0, reviewsFromThisReviewer: 1, tiedToCompletedSwap: true },
            ],
        });
        expect(out.countedReviews).toBe(1);
        expect(out.weightedReviews).toBeCloseTo(1, 5);
    });

    it('falls back gracefully (no error, sentimentUsed=false) when reviews lack sentiment', () => {
        const out = computeCosmicScore({
            reviews: [
                { rating: 5, ageDays: 0, reviewsFromThisReviewer: 1, tiedToCompletedSwap: true },
                { rating: 4, ageDays: 10, reviewsFromThisReviewer: 1, tiedToCompletedSwap: true },
            ],
            completedSwaps: 5,
            activeDaysThisSeason: 10,
        });
        expect(out.sentimentUsed).toBe(false);
        expect(out.weights.rating).toBeCloseTo(0.78, 5);
        expect(Number.isFinite(out.score)).toBe(true);
    });

    it('uses sentiment when present and produces a higher rating-region score', () => {
        const withPos = computeCosmicScore({
            reviews: [{ rating: 5, sentiment: 1, ageDays: 0, reviewsFromThisReviewer: 1, tiedToCompletedSwap: true }],
            completedSwaps: 10, activeDaysThisSeason: 30,
        });
        expect(withPos.sentimentUsed).toBe(true);
        expect(withPos.score).toBeGreaterThan(0);
        expect(withPos.score).toBeLessThanOrEqual(100);
    });
});
