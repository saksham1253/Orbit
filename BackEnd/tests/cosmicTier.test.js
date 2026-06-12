const {
    LADDER,
    rawTierFromScore,
    applyGates,
    progressToNext,
    assignTier,
    compareTiers,
    isCategoryPromotion,
} = require('../services/cosmicTier');

const HIGH_CTX = { weightedReviews: 1000, seasonsPlayed: 5 }; // clears every gate

describe('cosmicTier — ladder integrity', () => {
    it('has exactly 24 public divisions', () => {
        expect(LADDER).toHaveLength(24);
    });

    it('thresholds are strictly increasing', () => {
        for (let i = 1; i < LADDER.length; i++) {
            expect(LADDER[i].min).toBeGreaterThan(LADDER[i - 1].min);
        }
    });

    it('tierIds are unique', () => {
        const ids = LADDER.map((t) => t.tierId);
        expect(new Set(ids).size).toBe(ids.length);
    });
});

describe('cosmicTier — rawTierFromScore (§6.6 table)', () => {
    it('0 → Moon IV', () => {
        expect(rawTierFromScore(0).tierId).toBe('moon_4');
    });

    it('boundaries map to the upper tier (inclusive min)', () => {
        expect(rawTierFromScore(6).tierId).toBe('moon_3');
        expect(rawTierFromScore(24).tierId).toBe('planet_4');
        expect(rawTierFromScore(48).tierId).toBe('star_4');
        expect(rawTierFromScore(71).tierId).toBe('pulsar_4');
        expect(rawTierFromScore(89).tierId).toBe('supernova_4');
        expect(rawTierFromScore(97.5).tierId).toBe('galaxy_4');
    });

    it('just-below a boundary stays in the lower tier', () => {
        expect(rawTierFromScore(5.99).tierId).toBe('moon_4');
        expect(rawTierFromScore(23.99).tierId).toBe('moon_1');
        expect(rawTierFromScore(99.59).tierId).toBe('galaxy_2'); // galaxy_1 starts at 99.6
    });

    it('100 → Galaxy I', () => {
        expect(rawTierFromScore(100).tierId).toBe('galaxy_1');
    });

    it('clamps out-of-range and non-finite scores', () => {
        expect(rawTierFromScore(-50).tierId).toBe('moon_4');
        expect(rawTierFromScore(150).tierId).toBe('galaxy_1');
        expect(rawTierFromScore(NaN).tierId).toBe('moon_4');
    });
});

describe('cosmicTier — eligibility gates (§6.6)', () => {
    it('caps a high score at Planet I when below the Star gate (8 weighted reviews)', () => {
        const raw = rawTierFromScore(70); // would be star_1 region
        const { tier, gated } = applyGates(raw, { weightedReviews: 3 });
        expect(tier.tierId).toBe('planet_1');
        expect(gated).toBe(true);
    });

    it('allows Star when the 8-review gate is cleared', () => {
        const raw = rawTierFromScore(55); // star_3
        const { tier, gated } = applyGates(raw, { weightedReviews: 8 });
        expect(tier.tierId).toBe('star_3');
        expect(gated).toBe(false);
    });

    it('caps Pulsar+ at Star I below 20 weighted reviews', () => {
        const raw = rawTierFromScore(80); // pulsar region
        const { tier, gated } = applyGates(raw, { weightedReviews: 10 });
        expect(tier.tierId).toBe('star_1');
        expect(gated).toBe(true);
    });

    it('caps Galaxy at Supernova I without a full season even with 50 reviews', () => {
        const raw = rawTierFromScore(99); // galaxy region
        const { tier, gated } = applyGates(raw, { weightedReviews: 60, seasonsPlayed: 0 });
        expect(tier.tierId).toBe('supernova_1');
        expect(gated).toBe(true);
    });

    it('allows Galaxy with 50 reviews and 1 season', () => {
        const raw = rawTierFromScore(99); // 99 is in the galaxy_3 band (98.4–99.1)
        const { tier, gated } = applyGates(raw, { weightedReviews: 50, seasonsPlayed: 1 });
        expect(tier.tierId).toBe('galaxy_3');
        expect(gated).toBe(false);
    });

    it('never gates Moon/Planet tiers', () => {
        expect(applyGates(rawTierFromScore(10), { weightedReviews: 0 }).gated).toBe(false);
        expect(applyGates(rawTierFromScore(40), { weightedReviews: 0 }).gated).toBe(false);
    });
});

describe('cosmicTier — progressToNext', () => {
    it('is 0 at the bottom of a tier and approaches 1 near the next threshold', () => {
        expect(progressToNext(0, rawTierFromScore(0))).toBeCloseTo(0, 5);
        // Moon IV spans 0..6; score 3 = halfway
        expect(progressToNext(3, rawTierFromScore(3))).toBeCloseTo(0.5, 5);
    });

    it('is 1 at the top tier (Galaxy I)', () => {
        expect(progressToNext(100, rawTierFromScore(100))).toBe(1);
    });
});

describe('cosmicTier — assignTier (end-to-end)', () => {
    it('a new user (score 0) is Moon IV, ungated', () => {
        const t = assignTier(0, { weightedReviews: 0 });
        expect(t.tierId).toBe('moon_4');
        expect(t.category).toBe('moon');
        expect(t.division).toBe(4);
        expect(t.gated).toBe(false);
        expect(t.displayName).toMatch(/Deimos/);
    });

    it('reports a gate reason when capped', () => {
        // 80 is in the pulsar_3 band (76–81). With only 5 weighted reviews the
        // mentor fails the Pulsar gate (→Star I) AND the Star gate (5<8), so it
        // cascades to Planet I.
        const t = assignTier(80, { weightedReviews: 5 });
        expect(t.tierId).toBe('planet_1');
        expect(t.rawTierId).toBe('pulsar_3');
        expect(t.gated).toBe(true);
        expect(t.gateReason).toMatch(/weighted reviews/);
    });

    it('a fully-qualified top mentor reaches Galaxy I', () => {
        const t = assignTier(100, HIGH_CTX);
        expect(t.tierId).toBe('galaxy_1');
        expect(t.progressToNext).toBe(1);
    });
});

describe('cosmicTier — comparisons & promotions', () => {
    it('compareTiers orders by ladder height; quasar is highest', () => {
        expect(compareTiers('star_1', 'moon_4')).toBeGreaterThan(0);
        expect(compareTiers('moon_4', 'star_1')).toBeLessThan(0);
        expect(compareTiers('quasar', 'galaxy_1')).toBeGreaterThan(0);
        expect(compareTiers('star_2', 'star_2')).toBe(0);
    });

    it('isCategoryPromotion is true only across categories going up', () => {
        expect(isCategoryPromotion('planet_1', 'star_4')).toBe(true);  // planet→star
        expect(isCategoryPromotion('star_4', 'star_1')).toBe(false);   // within star
        expect(isCategoryPromotion('star_4', 'planet_1')).toBe(false); // demotion
        expect(isCategoryPromotion('moon_1', 'planet_4')).toBe(true);  // moon→planet
    });
});
