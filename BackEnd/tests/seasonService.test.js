const { detectReviewRings, velocityGuard, seasonIdFor, seasonBounds } = require('../services/seasonService');

describe('seasonService — detectReviewRings (§15.2)', () => {
  it('flags a reciprocal pair A↔B', () => {
    const flagged = detectReviewRings([
      { from: 'A', to: 'B' },
      { from: 'B', to: 'A' },
    ]);
    expect(flagged.has('A->B')).toBe(true);
    expect(flagged.has('B->A')).toBe(true);
  });

  it('does not flag a one-directional review', () => {
    const flagged = detectReviewRings([
      { from: 'A', to: 'B' },
      { from: 'C', to: 'B' },
    ]);
    expect(flagged.size).toBe(0);
  });

  it('flags a 3-cycle A→B→C→A', () => {
    const flagged = detectReviewRings([
      { from: 'A', to: 'B' },
      { from: 'B', to: 'C' },
      { from: 'C', to: 'A' },
    ]);
    expect(flagged.has('A->B')).toBe(true);
    expect(flagged.has('B->C')).toBe(true);
    expect(flagged.has('C->A')).toBe(true);
  });

  it('leaves an honest star graph untouched', () => {
    const flagged = detectReviewRings([
      { from: 'L1', to: 'M' },
      { from: 'L2', to: 'M' },
      { from: 'L3', to: 'M' },
    ]);
    expect(flagged.size).toBe(0);
  });
});

describe('seasonService — velocityGuard (§15.2)', () => {
  it('throttles many reviews from very few reviewers', () => {
    expect(velocityGuard({ reviewsLast24h: 10, distinctReviewers24h: 1 }).throttle).toBe(true);
  });
  it('allows healthy review velocity', () => {
    expect(velocityGuard({ reviewsLast24h: 10, distinctReviewers24h: 9 }).throttle).toBe(false);
    expect(velocityGuard({ reviewsLast24h: 3, distinctReviewers24h: 1 }).throttle).toBe(false);
  });
});

describe('seasonService — season ids', () => {
  it('formats YYYY-MM in UTC', () => {
    expect(seasonIdFor(new Date('2026-06-13T10:00:00Z'))).toBe('2026-06');
    expect(seasonIdFor(new Date('2026-01-01T00:00:00Z'))).toBe('2026-01');
  });
  it('bounds span exactly the month', () => {
    const { startsAt, endsAt } = seasonBounds(new Date('2026-06-13T10:00:00Z'));
    expect(startsAt.toISOString()).toBe('2026-06-01T00:00:00.000Z');
    expect(endsAt.toISOString()).toBe('2026-07-01T00:00:00.000Z');
  });
});
