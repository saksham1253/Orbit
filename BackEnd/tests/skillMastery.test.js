const {
    MASTERY_TIERS, currentTier, nextTier, masteryFor, tierReachedOnIncrement,
} = require("../services/skillMastery");

describe("skillMastery — tier lookup", () => {
    it("has no rank below the first threshold", () => {
        expect(currentTier(0)).toBeNull();
        const m = masteryFor(0, "Guitar");
        expect(m.level).toBe(0);
        expect(m.badge).toBeNull();
        expect(m.next.title).toBe("Initiate");
    });

    it("names the badge from the skill + rank", () => {
        const m = masteryFor(10, "Guitar");
        expect(m.rank).toBe("Mentor");
        expect(m.badge).toBe("Guitar Mentor");
        expect(m.level).toBe(3);
    });

    it("reports the next tier and remaining sessions", () => {
        const m = masteryFor(5, "Piano"); // between Apprentice(3) and Mentor(10)
        expect(m.rank).toBe("Apprentice");
        expect(m.next.title).toBe("Mentor");
        expect(m.toNext).toBe(5);
    });

    it("progress is 0 at a tier floor and rises toward the next", () => {
        expect(masteryFor(3, "X").progressPct).toBe(0);   // exactly at Apprentice floor
        expect(masteryFor(10, "X").progressPct).toBe(0);  // exactly at Mentor floor
        const mid = masteryFor(6, "X").progressPct;        // 3→10 span, at 6 → ~43%
        expect(mid).toBeGreaterThan(0);
        expect(mid).toBeLessThan(100);
    });

    it("maxes out at the top tier", () => {
        const m = masteryFor(999, "Chess");
        expect(m.maxed).toBe(true);
        expect(m.next).toBeNull();
        expect(m.progressPct).toBe(100);
        expect(m.rank).toBe(MASTERY_TIERS[MASTERY_TIERS.length - 1].title);
    });
});

describe("skillMastery — crossing detection (award once)", () => {
    it("returns the tier newly crossed by an increment", () => {
        expect(tierReachedOnIncrement(0, 1).title).toBe("Initiate");
        expect(tierReachedOnIncrement(9, 10).title).toBe("Mentor");
    });

    it("returns null when no threshold is crossed", () => {
        expect(tierReachedOnIncrement(10, 11)).toBeNull();
        expect(tierReachedOnIncrement(3, 4)).toBeNull();
    });

    it("nextTier returns null once maxed", () => {
        expect(nextTier(50)).toBeNull();
    });
});
