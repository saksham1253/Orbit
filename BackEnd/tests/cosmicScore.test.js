const {
    reviewWeight,
    bayesianRating,
    sentimentScore,
    normSwaps,
    normActivity,
    compositeScore,
    rebaseScore,
    computeCosmicScore,
    FLOOR,
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

describe('cosmicScore — compositeScore (v2 §2.1, returns 0..1)', () => {
    it('a perfect mentor composites to 1.0', () => {
        const { composite01 } = compositeScore({
            normRating: 1, normSentiment: 1, sentimentAvailable: true,
            normSwaps: 1, normActivity: 1,
        });
        expect(composite01).toBeCloseTo(1, 5);
    });

    it('uses the documented weights when sentiment is available', () => {
        const { composite01, sentimentUsed, weights } = compositeScore({
            normRating: 1, normSentiment: 0, sentimentAvailable: true,
            normSwaps: 0, normActivity: 0,
        });
        expect(sentimentUsed).toBe(true);
        expect(weights.rating).toBeCloseTo(WEIGHTS.rating, 5);
        expect(composite01).toBeCloseTo(0.62, 5);
    });

    it('redistributes the 0.16 sentiment weight into rating when unavailable', () => {
        const { composite01, sentimentUsed, weights } = compositeScore({
            normRating: 1, normSentiment: 0, sentimentAvailable: false,
            normSwaps: 0, normActivity: 0,
        });
        expect(sentimentUsed).toBe(false);
        expect(weights.rating).toBeCloseTo(0.78, 5);
        expect(composite01).toBeCloseTo(0.78, 5);
    });

    it('respects the global sentimentEnabled=false flag even if data exists', () => {
        const { sentimentUsed, weights } = compositeScore({
            normRating: 1, normSentiment: 1, sentimentAvailable: true,
            normSwaps: 0, normActivity: 0, sentimentEnabled: false,
        });
        expect(sentimentUsed).toBe(false);
        expect(weights.rating).toBeCloseTo(0.78, 5);
    });
});

describe('cosmicScore — rebaseScore (v4 §1 symmetric, floor 0)', () => {
    it('returns exactly the warm start below the ranking threshold', () => {
        expect(rebaseScore(1, 0)).toBe(FLOOR);   // brand-new → 50
        expect(rebaseScore(0.5, 0.5)).toBe(FLOOR);
    });
    it('few reviews stay near 50 (confidence damps both ways)', () => {
        // composite 0.567 → raw 56.7; confidence 0.2 → 50 + 6.7*0.2 ≈ 51.3
        expect(rebaseScore(0.567, 2)).toBeCloseTo(51.34, 1);
    });
    it('full confidence at 10+ reviews maps composite hinged at 50', () => {
        expect(rebaseScore(1, 10)).toBeCloseTo(100, 5);   // climb
        expect(rebaseScore(0, 10)).toBe(0);               // DESCEND to floor 0
        expect(rebaseScore(0.5, 20)).toBeCloseTo(50, 5);  // neutral → 50
    });
    it('a poor composite descends below 50 (The Descent)', () => {
        // composite 0.366, 12 reviews → raw 36.6, confidence 1 → 36.6
        expect(rebaseScore(0.366, 12)).toBeCloseTo(36.6, 1);
    });
    it('never returns below 0 or above 100', () => {
        expect(rebaseScore(-1, 50)).toBe(0);
        expect(rebaseScore(5, 50)).toBe(100);
    });
});

describe('cosmicScore — computeCosmicScore (end-to-end, v4)', () => {
    it('a brand-new user with no reviews scores exactly the warm start (50)', () => {
        const out = computeCosmicScore({ reviews: [], completedSwaps: 0, activeDaysThisSeason: 0 });
        expect(out.score).toBe(FLOOR);
        expect(out.weightedReviews).toBe(0);
    });

    it('the worked example: 2 strong reviews → low Moon (NOT Planet, NOT Descent)', () => {
        const out = computeCosmicScore({
            reviews: [
                { rating: 5, ageDays: 0, reviewsFromThisReviewer: 1, tiedToCompletedSwap: true },
                { rating: 5, ageDays: 0, reviewsFromThisReviewer: 1, tiedToCompletedSwap: true },
            ],
            completedSwaps: 0, activeDaysThisSeason: 0,
        });
        // confidence 0.2 damps a strong composite → stays just above 50 (Moon IV/III)
        expect(out.score).toBeGreaterThanOrEqual(50);
        expect(out.score).toBeLessThan(62);    // hard rule: < 62 is always Moon (or below)
    });

    it('a genuinely struggling mentor (many low reviews) descends below 50', () => {
        const out = computeCosmicScore({
            reviews: Array.from({ length: 12 }, () => ({ rating: 2, ageDays: 0, reviewsFromThisReviewer: 1, tiedToCompletedSwap: true })),
            completedSwaps: 1, activeDaysThisSeason: 3,
        });
        expect(out.score).toBeLessThan(50);    // The Descent
        expect(out.score).toBeGreaterThanOrEqual(0);
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

    it('two users with different reviews get different scores', () => {
        const weak = computeCosmicScore({
            reviews: Array.from({ length: 12 }, () => ({ rating: 3, ageDays: 0, reviewsFromThisReviewer: 1, tiedToCompletedSwap: true })),
            completedSwaps: 2,
        });
        const strong = computeCosmicScore({
            reviews: Array.from({ length: 12 }, () => ({ rating: 5, ageDays: 0, reviewsFromThisReviewer: 1, tiedToCompletedSwap: true })),
            completedSwaps: 20,
        });
        expect(strong.score).toBeGreaterThan(weak.score);
        expect(strong.score).not.toBeCloseTo(weak.score, 1);
    });

    it('never errors and stays within [0,100] under fallback weighting', () => {
        const out = computeCosmicScore({
            reviews: [{ rating: 4, ageDays: 10, reviewsFromThisReviewer: 1, tiedToCompletedSwap: true }],
            completedSwaps: 5, activeDaysThisSeason: 10,
        });
        expect(out.sentimentUsed).toBe(false);
        expect(out.score).toBeGreaterThanOrEqual(50);
        expect(out.score).toBeLessThanOrEqual(100);
    });
});
