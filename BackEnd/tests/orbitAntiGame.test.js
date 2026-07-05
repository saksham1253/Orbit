const { qualifyMessage, applyWeeklyCap } = require("../services/orbitAntiGame");

const P = (n) => `partner${n}`;

describe("orbitAntiGame — distinct-partner message rule", () => {
    it("credits the first message to a new partner", () => {
        const r = qualifyMessage({ day: "2026-07-06", partners: [] }, P(1), "2026-07-06");
        expect(r.qualifiesForStreak).toBe(true);
        expect(r.xpFactor).toBe(1);
        expect(r.msgCredit.partners).toEqual([P(1)]);
    });

    it("gives NO further credit for repeat messages to the same partner today (spam)", () => {
        let s = qualifyMessage({ day: "2026-07-06", partners: [] }, P(1), "2026-07-06").msgCredit;
        // fire 20 more "hi" to the same partner
        let last;
        for (let i = 0; i < 20; i++) last = qualifyMessage(s, P(1), "2026-07-06");
        expect(last.qualifiesForStreak).toBe(false);
        expect(last.xpFactor).toBe(0);
        expect(last.reason).toBe("already_credited");
        // still only one partner recorded
        expect(last.msgCredit.partners).toEqual([P(1)]);
    });

    it("resets at the UTC day boundary", () => {
        const s = { day: "2026-07-06", partners: [P(1), P(2)] };
        const r = qualifyMessage(s, P(1), "2026-07-07"); // new day → P1 fresh again
        expect(r.qualifiesForStreak).toBe(true);
        expect(r.msgCredit.day).toBe("2026-07-07");
        expect(r.msgCredit.partners).toEqual([P(1)]);
    });
});

describe("orbitAntiGame — daily XP taper (cap distinct partners)", () => {
    it("full XP for the first N distinct partners, 0 beyond (still streak-eligible)", () => {
        let s = { day: "2026-07-06", partners: [] };
        const factors = [];
        for (let i = 1; i <= 6; i++) {
            const r = qualifyMessage(s, P(i), "2026-07-06", { dailyXpCap: 3 });
            s = r.msgCredit;
            factors.push([r.qualifiesForStreak, r.xpFactor]);
        }
        // partners 1-3 → xp; 4-6 → streak-eligible but no xp
        expect(factors).toEqual([
            [true, 1], [true, 1], [true, 1],
            [true, 0], [true, 0], [true, 0],
        ]);
    });

    it("honors the quality gate", () => {
        const r = qualifyMessage({ day: "2026-07-06", partners: [] }, P(1), "2026-07-06", { quality: false });
        expect(r.qualifiesForStreak).toBe(false);
        expect(r.reason).toBe("low_quality");
    });

    it("rejects a missing partner id", () => {
        const r = qualifyMessage({ day: "2026-07-06", partners: [] }, null, "2026-07-06");
        expect(r.qualifiesForStreak).toBe(false);
        expect(r.reason).toBe("no_partner");
    });
});

describe("orbitAntiGame — weekly per-source cap", () => {
    it("grants up to the remaining room and reports capping", () => {
        expect(applyWeeklyCap(0, 5, 60)).toEqual({ granted: 5, total: 5, capped: false });
        expect(applyWeeklyCap(58, 5, 60)).toEqual({ granted: 2, total: 60, capped: true });
        expect(applyWeeklyCap(60, 5, 60)).toEqual({ granted: 0, total: 60, capped: true });
    });

    it("is uncapped when cap <= 0", () => {
        expect(applyWeeklyCap(100, 30, 0)).toEqual({ granted: 30, total: 130, capped: false });
    });

    it("message-only strategy is bounded: 5xp × 3 partners/day × 7 days is capped weekly", () => {
        // simulate a week of maxed message XP against a 60 cap
        let total = 0;
        for (let day = 0; day < 7; day++) {
            for (let p = 0; p < 3; p++) {
                const r = applyWeeklyCap(total, 5, 60);
                total = r.total;
            }
        }
        expect(total).toBe(60); // hard-capped — cannot fund a promotion on messages alone
    });
});
