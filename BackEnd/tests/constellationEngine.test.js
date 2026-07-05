const {
    applyPairContribution,
    grantWeeklyFreezePair,
    pairDecayState,
    nextPairMilestone,
    pairKeyOf,
    PAIR_MILESTONES,
    FREEZE_CAP_PAIR,
} = require("../services/constellationEngine");

const A = "aaaaaaaaaaaaaaaaaaaaaaaa";
const B = "bbbbbbbbbbbbbbbbbbbbbbbb";
const MEMBERS = [A, B];

const fresh = (over = {}) => ({
    streak: { current: 0, longest: 0, lastBothDay: null, milestonesHit: [] },
    lastActionDay: {},
    freezeTokens: 0,
    ...over,
});

describe("constellationEngine — shared advance requires BOTH", () => {
    it("records one member's contribution without advancing", () => {
        const r = applyPairContribution(fresh(), A, MEMBERS, "2026-07-03");
        expect(r.recorded).toBe(true);
        expect(r.advanced).toBe(false);
        expect(r.state.streak.current).toBe(0);
        expect(r.state.lastActionDay[A]).toBe("2026-07-03");
    });

    it("advances once when the second member acts the same day", () => {
        let st = applyPairContribution(fresh(), A, MEMBERS, "2026-07-03").state;
        const r = applyPairContribution({ ...st, freezeTokens: 0 }, B, MEMBERS, "2026-07-03");
        expect(r.advanced).toBe(true);
        expect(r.state.streak.current).toBe(1);
        expect(r.state.streak.lastBothDay).toBe("2026-07-03");
    });

    it("is idempotent once both acted (a third action same day does nothing)", () => {
        let st = applyPairContribution(fresh(), A, MEMBERS, "2026-07-03").state;
        st = applyPairContribution(st, B, MEMBERS, "2026-07-03").state;
        const again = applyPairContribution(st, A, MEMBERS, "2026-07-03");
        expect(again.advanced).toBe(false);
        expect(again.state.streak.current).toBe(1);
    });

    it("advances on consecutive both-days", () => {
        let st = applyPairContribution(fresh(), A, MEMBERS, "2026-07-03").state;
        st = applyPairContribution(st, B, MEMBERS, "2026-07-03").state;
        st = applyPairContribution(st, A, MEMBERS, "2026-07-04").state;
        const r = applyPairContribution(st, B, MEMBERS, "2026-07-04");
        expect(r.state.streak.current).toBe(2);
        expect(r.state.streak.longest).toBe(2);
    });
});

describe("constellationEngine — reset & shared freeze", () => {
    it("resets to 1 when the pair misses a day with no freeze", () => {
        const st = fresh({
            streak: { current: 9, longest: 9, lastBothDay: "2026-07-03", milestonesHit: [3, 7] },
            lastActionDay: { [A]: "2026-07-03", [B]: "2026-07-03" },
            freezeTokens: 0,
        });
        let s2 = applyPairContribution(st, A, MEMBERS, "2026-07-05").state;
        const r = applyPairContribution(s2, B, MEMBERS, "2026-07-05");
        expect(r.state.streak.current).toBe(1);
        expect(r.state.streak.longest).toBe(9);
        expect(r.streakSaved).toBe(false);
    });

    it("bridges a missed day with a shared freeze token", () => {
        const st = fresh({
            streak: { current: 20, longest: 20, lastBothDay: "2026-07-03", milestonesHit: [3, 7, 14] },
            lastActionDay: { [A]: "2026-07-03", [B]: "2026-07-03" },
            freezeTokens: 2,
        });
        let s2 = applyPairContribution(st, A, MEMBERS, "2026-07-05").state; // missed the 4th
        const r = applyPairContribution(s2, B, MEMBERS, "2026-07-05");
        expect(r.streakSaved).toBe(true);
        expect(r.freezeUsed).toBe(1);
        expect(r.state.streak.current).toBe(21);
        expect(r.state.freezeTokens).toBe(1);
    });

    it("grants one shared freeze per ISO week, capped, idempotent", () => {
        let f = { tokens: 0, lastGrantWeek: "" };
        ({ freeze: f } = grantWeeklyFreezePair(f, "2026-W27"));
        expect(f.tokens).toBe(1);
        expect(grantWeeklyFreezePair(f, "2026-W27").granted).toBe(false);
        const capped = grantWeeklyFreezePair({ tokens: FREEZE_CAP_PAIR, lastGrantWeek: "2026-W27" }, "2026-W28");
        expect(capped.freeze.tokens).toBe(FREEZE_CAP_PAIR);
    });
});

describe("constellationEngine — milestones", () => {
    it("pays each member once when a shared milestone is reached", () => {
        const st = fresh({
            streak: { current: 6, longest: 6, lastBothDay: "2026-07-03", milestonesHit: [3] },
            lastActionDay: { [A]: "2026-07-04", [B]: "2026-07-03" },
            freezeTokens: 0,
        });
        // B acts on the 4th → both on 4th → advance to 7 = Steady Binary
        const r = applyPairContribution(st, B, MEMBERS, "2026-07-04");
        expect(r.state.streak.current).toBe(7);
        expect(r.milestone.name).toBe("Steady Binary");
        expect(r.stardustEach).toBe(PAIR_MILESTONES.find((m) => m.days === 7).stardust);
    });

    it("nextPairMilestone returns the next rung", () => {
        expect(nextPairMilestone(7).days).toBe(14);
        expect(nextPairMilestone(100)).toBeNull();
    });
});

describe("constellationEngine — decay state & pair key", () => {
    it("reports waiting on the partner when only one acted", () => {
        const r = pairDecayState({ current: 3, lastBothDay: "2026-07-02" }, { [A]: "2026-07-03" }, MEMBERS, "2026-07-03");
        expect(r.state).toBe("waiting");
        expect(r.waitingOn).toBe(B);
    });
    it("reports active when both acted today", () => {
        const r = pairDecayState({ current: 3, lastBothDay: "2026-07-03" }, { [A]: "2026-07-03", [B]: "2026-07-03" }, MEMBERS, "2026-07-03");
        expect(r.state).toBe("active");
    });
    it("reports decaying when a streak exists but nobody acted today", () => {
        const r = pairDecayState({ current: 3, lastBothDay: "2026-07-02" }, { [A]: "2026-07-02", [B]: "2026-07-02" }, MEMBERS, "2026-07-03");
        expect(r.state).toBe("decaying");
    });
    it("pairKeyOf is order-independent", () => {
        expect(pairKeyOf(A, B)).toBe(pairKeyOf(B, A));
    });
});
