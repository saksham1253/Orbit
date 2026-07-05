const sim = require("../services/antiGameSim");
const preflight = require("../services/orbitPreflight");
const cfg = require("../services/orbitConfig");

describe("antiGameSim — proves B1 without a DB (C3)", () => {
    it("20 messages to the SAME partner → ≤1 streak day + only the first earns XP", () => {
        const r = sim.simulate({ targets: ["p1"], count: 20 });
        expect(r.totals.streakDaysGranted).toBe(1);
        expect(r.totals.distinctPartnersCredited).toBe(1);
        expect(r.perMessage.filter((m) => m.xp > 0).length).toBe(1); // only msg #1
        expect(r.perMessage[1].reason).toBe("already_credited");
        expect(r.assertions.every((a) => a.pass)).toBe(true);
    });

    it("5 messages to 5 DIFFERENT partners → first cap earn XP, rest streak-only", () => {
        const r = sim.simulate({ targets: ["a", "b", "c", "d", "e"], count: 5 });
        expect(r.perMessage.filter((m) => m.xp > 0).length).toBe(cfg.MSG.dailyXpCap);
        expect(r.perMessage.every((m) => m.countedForStreak)).toBe(true); // all distinct → streak-eligible
        expect(r.totals.streakDaysGranted).toBe(1);
    });

    it("never writes anything (pure) and honors a custom weekly cap", () => {
        const r = sim.simulate({ targets: ["a", "b", "c", "d"], count: 4, weeklyCap: 10 });
        expect(r.totals.xpTotal).toBeLessThanOrEqual(10);
    });
});

describe("orbitPreflight — one-click invariant checks (C8)", () => {
    it("every built-in check passes on the current build", () => {
        const results = preflight.run();
        const failing = results.filter((r) => r.status !== "pass");
        expect(failing).toEqual([]);          // green board
        expect(results.length).toBe(preflight.CHECK_IDS.length);
    });

    it("can run a single check by id", () => {
        const [r] = preflight.run("graduation_sticky");
        expect(r.id).toBe("graduation_sticky");
        expect(r.status).toBe("pass");
    });
});
