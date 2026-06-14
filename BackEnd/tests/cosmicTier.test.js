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
    it('has 36 public divisions (24 ascent + 12 Descent)', () => {
        expect(LADDER).toHaveLength(36);
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

describe('cosmicTier — rawTierFromScore (v2 floors, 50..100)', () => {
    it('floor 50 → Moon IV', () => {
        expect(rawTierFromScore(50).tierId).toBe('moon_4');
    });

    it('entry scores map to the expected tier (v2 floors)', () => {
        expect(rawTierFromScore(53).tierId).toBe('moon_3');
        expect(rawTierFromScore(62).tierId).toBe('planet_4');
        expect(rawTierFromScore(74).tierId).toBe('star_4');
        expect(rawTierFromScore(85).tierId).toBe('pulsar_4');
        expect(rawTierFromScore(93).tierId).toBe('supernova_4');
        expect(rawTierFromScore(98).tierId).toBe('galaxy_4');
    });

    it('HARD RULE: any score < 62 is always a Moon tier', () => {
        for (const s of [50, 52, 55.7, 58, 61.99]) {
            expect(rawTierFromScore(s).category).toBe('moon');
        }
    });

    it('just-below a boundary stays in the lower tier', () => {
        expect(rawTierFromScore(52.99).tierId).toBe('moon_4');
        expect(rawTierFromScore(61.99).tierId).toBe('moon_1');
        expect(rawTierFromScore(99.69).tierId).toBe('galaxy_2'); // galaxy_1 starts at 99.7
    });

    it('100 → Galaxy I', () => {
        expect(rawTierFromScore(100).tierId).toBe('galaxy_1');
    });

    it('clamps out-of-range scores; 0 is now the lowest Descent tier (v4)', () => {
        expect(rawTierFromScore(0).tierId).toBe('stardust_4');
        expect(rawTierFromScore(150).tierId).toBe('galaxy_1');
        expect(rawTierFromScore(NaN).tierId).toBe('stardust_4');
    });
});

describe('cosmicTier — eligibility gates (50..100)', () => {
    it('caps a Star-region score at Planet I when below the 8-review gate', () => {
        const raw = rawTierFromScore(75); // star_4 region
        const { tier, gated } = applyGates(raw, { weightedReviews: 3 });
        expect(tier.tierId).toBe('planet_1');
        expect(gated).toBe(true);
    });

    it('allows Star when the 8-review gate is cleared', () => {
        const raw = rawTierFromScore(78); // star_3
        const { tier, gated } = applyGates(raw, { weightedReviews: 8 });
        expect(tier.tierId).toBe('star_3');
        expect(gated).toBe(false);
    });

    it('caps Pulsar+ at Star I below 20 weighted reviews', () => {
        const raw = rawTierFromScore(88); // pulsar region
        const { tier, gated } = applyGates(raw, { weightedReviews: 10 });
        expect(tier.tierId).toBe('star_1');
        expect(gated).toBe(true);
    });

    it('caps Galaxy at Supernova I without a full season even with 50 reviews', () => {
        const raw = rawTierFromScore(98.5); // galaxy region
        const { tier, gated } = applyGates(raw, { weightedReviews: 60, seasonsPlayed: 0 });
        expect(tier.tierId).toBe('supernova_1');
        expect(gated).toBe(true);
    });

    it('allows Galaxy with 50 reviews and 1 season', () => {
        const raw = rawTierFromScore(98.5); // galaxy_4 band (98.0–98.7)
        const { tier, gated } = applyGates(raw, { weightedReviews: 50, seasonsPlayed: 1 });
        expect(tier.tierId).toBe('galaxy_4');
        expect(gated).toBe(false);
    });

    it('never gates Moon/Planet tiers', () => {
        expect(applyGates(rawTierFromScore(55), { weightedReviews: 0 }).gated).toBe(false);
        expect(applyGates(rawTierFromScore(70), { weightedReviews: 0 }).gated).toBe(false);
    });
});

describe('cosmicTier — progress (v2 §1.1 modes)', () => {
    it('progress mode within a band: 0 at floor, ~0.5 mid-band', () => {
        expect(progressToNext(50, rawTierFromScore(50))).toBeCloseTo(0, 5);
        // Moon IV spans 50..53; score 51.5 = halfway
        expect(progressToNext(51.5, rawTierFromScore(51.5))).toBeCloseTo(0.5, 5);
    });

    it('locked mode when the next tier is gated (Planet I → Star needs 8)', () => {
        const t = assignTier(72, { weightedReviews: 3 });
        expect(t.progress.mode).toBe('locked');
        expect(t.progress.label).toMatch(/more weighted review/);
        expect(t.progress.pct).toBeCloseTo(3 / 8, 5);
    });

    it('max mode at Galaxy I', () => {
        const t = assignTier(100, { weightedReviews: 1000, seasonsPlayed: 5 });
        expect(t.tierId).toBe('galaxy_1');
        expect(t.progress.mode).toBe('max');
        expect(t.progress.pct).toBe(1);
    });
});

describe('cosmicTier — assignTier (end-to-end, v2)', () => {
    it('a new user (score 50) is Moon IV, ungated', () => {
        const t = assignTier(50, { weightedReviews: 0 });
        expect(t.tierId).toBe('moon_4');
        expect(t.category).toBe('moon');
        expect(t.division).toBe(4);
        expect(t.gated).toBe(false);
        expect(t.displayName).toMatch(/Deimos/);
    });

    it('reports a gate reason when capped (Pulsar score, few reviews → Planet I)', () => {
        const t = assignTier(88, { weightedReviews: 5 });
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

const { resolveTier, bufferFor, tierObjectFor } = require('../services/cosmicTier');

describe('cosmicTier — The Descent (v4 §2)', () => {
  it('maps sub-50 scores to Descent tiers', () => {
    expect(rawTierFromScore(0).tierId).toBe('stardust_4');
    expect(rawTierFromScore(36.6).tierId).toBe('meteor_2'); // 35..39
    expect(rawTierFromScore(48.3).tierId).toBe('asteroid_2'); // 47..48.5
    expect(rawTierFromScore(49).tierId).toBe('asteroid_1');   // 48.5..50
    expect(rawTierFromScore(50).tierId).toBe('moon_4');
  });
});

describe('cosmicTier — hysteresis (v4 §3 worked example)', () => {
  it('Moon IV demote line is 48.5 (buffer 1.5)', () => {
    expect(bufferFor('moon_4')).toBeCloseTo(1.5, 5);
  });
  it('stays Moon IV in the grace zone, demotes to Asteroid II below it', () => {
    expect(resolveTier('moon_4', 49.6)).toBe('moon_4'); // grace
    expect(resolveTier('moon_4', 48.9)).toBe('moon_4'); // grace
    expect(resolveTier('moon_4', 48.3)).toBe('asteroid_2'); // demote (lands Asteroid II)
  });
  it('promotes immediately on the way up', () => {
    expect(resolveTier('asteroid_2', 49.9)).toBe('asteroid_1');
    expect(resolveTier('asteroid_2', 50.0)).toBe('moon_4');
  });
  it('narrow top bands get a proportionally smaller buffer', () => {
    expect(bufferFor('galaxy_3')).toBeLessThan(1.5); // band 0.6 → buffer 0.3
  });
  it('quasar is permanent', () => {
    expect(resolveTier('quasar', 10)).toBe('quasar');
  });
});
