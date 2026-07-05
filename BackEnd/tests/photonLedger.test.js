const { aggregate } = require("../services/photonLedger");

const ev = (userId, delta, source) => ({ userId, delta, source });

describe("photonLedger.aggregate — economy reconciliation (C6)", () => {
    it("splits sources vs sinks and computes net supply", () => {
        const r = aggregate([
            ev("a", 60, "milestone"), ev("a", 40, "mission"),
            ev("b", 120, "mastery"),
            ev("a", -200, "cosmetic"), ev("b", -300, "freeze"),
        ]);
        expect(r.totalEarned).toBe(220);
        expect(r.totalSpent).toBe(500);
        expect(r.netSupply).toBe(-280);
        expect(r.sources).toEqual({ milestone: 60, mission: 40, mastery: 120 });
        expect(r.sinks).toEqual({ cosmetic: 200, freeze: 300 });
    });

    it("ranks top earners and spenders", () => {
        const r = aggregate([ev("a", 100, "mission"), ev("b", 50, "mission"), ev("a", -30, "freeze")]);
        expect(r.topEarners[0]).toEqual({ userId: "a", amount: 100 });
        expect(r.topSpenders[0]).toEqual({ userId: "a", amount: 30 });
    });

    it("raises the inflation alert when supply outpaces sinks", () => {
        expect(aggregate([ev("a", 1000, "milestone")]).inflationAlert).toBe(true);          // nothing spent
        expect(aggregate([ev("a", 1000, "x"), ev("a", -900, "y")]).inflationAlert).toBe(false); // healthy sink
    });
});
