const {
    DIVISION_IDS, GROUP_SIZE,
    xpFor, zoneFor, standings, applyRollover, rebuildGroups,
    promoteDivision, relegateDivision, higherDivision, divisionIndex,
} = require("../services/leagueService");

const mk = (userId, weekXp, divisionId = "nebula") => ({ userId, weekXp, divisionId });

describe("leagueService — XP + ladder", () => {
    it("awards XP per action metric", () => {
        expect(xpFor("swap")).toBe(30);
        expect(xpFor("rating")).toBe(15);
        expect(xpFor("message")).toBe(5);
        expect(xpFor("bogus")).toBe(0);
    });

    it("promote/relegate move one step and clamp at the edges", () => {
        expect(promoteDivision("nebula")).toBe(DIVISION_IDS[divisionIndex("nebula") + 1]);
        expect(relegateDivision("nebula")).toBe(DIVISION_IDS[divisionIndex("nebula") - 1]);
        expect(promoteDivision(DIVISION_IDS[DIVISION_IDS.length - 1])).toBe(DIVISION_IDS[DIVISION_IDS.length - 1]);
        expect(relegateDivision(DIVISION_IDS[0])).toBe(DIVISION_IDS[0]);
    });

    it("higherDivision keeps the lifetime best", () => {
        expect(higherDivision("nebula", "asteroid_belt")).toBe("nebula");
        expect(higherDivision("comet_run", "galaxy")).toBe("galaxy");
    });
});

describe("leagueService — zoning", () => {
    it("tags top as promote and bottom as relegate in a full group", () => {
        expect(zoneFor(1, 30, "nebula")).toBe("promote");
        expect(zoneFor(5, 30, "nebula")).toBe("promote");
        expect(zoneFor(6, 30, "nebula")).toBe("hold");
        expect(zoneFor(26, 30, "nebula")).toBe("relegate");
        expect(zoneFor(30, 30, "nebula")).toBe("relegate");
    });

    it("lowest division never relegates; highest never promotes", () => {
        expect(zoneFor(30, 30, DIVISION_IDS[0])).toBe("hold");        // no relegation below floor
        expect(zoneFor(1, 30, DIVISION_IDS[DIVISION_IDS.length - 1])).toBe("hold"); // no promo above cap
    });

    it("never overlaps promote/relegate zones in a tiny group", () => {
        const zones = [1, 2, 3].map((r) => zoneFor(r, 3, "nebula"));
        // With size 3, promoteCut=min(5, floor(3/2))=1; relegateCut=min(5, 3-1)=2
        expect(zones[0]).toBe("promote");
        expect(zones.filter((z) => z === "promote")).toHaveLength(1);
    });
});

describe("leagueService — standings", () => {
    it("ranks by weekly XP desc with deterministic tiebreak", () => {
        const members = [mk("a", 10), mk("b", 50), mk("c", 50)];
        const s = standings(members, "nebula");
        expect(s.map((m) => m.userId)).toEqual(["b", "c", "a"]); // b,c tie 50 → userId asc; a last
        expect(s[0].rank).toBe(1);
    });
});

describe("leagueService — rollover", () => {
    it("promotes the top and relegates the bottom", () => {
        const members = Array.from({ length: 30 }, (_, i) => mk(`u${String(i).padStart(2, "0")}`, 300 - i * 10));
        const out = applyRollover(members, "nebula");
        const byId = Object.fromEntries(out.map((o) => [o.userId, o]));
        expect(byId["u00"].result).toBe("promoted");         // highest XP
        expect(byId["u00"].nextDivisionId).toBe(promoteDivision("nebula"));
        expect(byId["u29"].result).toBe("relegated");        // lowest XP
        expect(byId["u29"].nextDivisionId).toBe(relegateDivision("nebula"));
        expect(byId["u15"].result).toBe("held");
    });

    it("keeps floor-division bottoms held (no relegation)", () => {
        const members = Array.from({ length: 10 }, (_, i) => mk(`u${i}`, 100 - i * 10, DIVISION_IDS[0]));
        const out = applyRollover(members, DIVISION_IDS[0]);
        expect(out.every((o) => o.result !== "relegated")).toBe(true);
    });
});

describe("leagueService — rebuildGroups", () => {
    it("chunks members into groups of GROUP_SIZE", () => {
        const members = Array.from({ length: GROUP_SIZE + 5 }, (_, i) => ({ userId: `u${i}` }));
        const groups = rebuildGroups(members, "nebula", "2026-W27");
        expect(groups[0].groupId).toBe("nebula:2026-W27:0");
        expect(groups[GROUP_SIZE].groupId).toBe("nebula:2026-W27:1"); // spilled into 2nd group
        expect(groups[GROUP_SIZE].index).toBe(1);
    });
});
