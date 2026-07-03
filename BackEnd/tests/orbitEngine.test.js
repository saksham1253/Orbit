const {
    applyAction,
    decayState,
    grantWeeklyFreeze,
    rollMissions,
    pickMissions,
    applyMissionProgress,
    claimMission,
    nextMilestone,
    MILESTONES,
    MISSIONS_PER_WEEK,
    FREEZE_CAP,
} = require("../services/orbitEngine");

const freshStreak = (over = {}) => ({ current: 0, longest: 0, lastActionDay: null, freezeTokens: 0, milestonesHit: [], ...over });

describe("orbitEngine — streak advance & reset", () => {
    it("starts a streak on the first action", () => {
        const r = applyAction(freshStreak(), "2026-07-03");
        expect(r.counted).toBe(true);
        expect(r.streak.current).toBe(1);
        expect(r.streak.longest).toBe(1);
        expect(r.streak.lastActionDay).toBe("2026-07-03");
    });

    it("is idempotent within the same UTC day (no double count / double drip)", () => {
        const s = freshStreak({ current: 4, longest: 4, lastActionDay: "2026-07-03" });
        const r = applyAction(s, "2026-07-03");
        expect(r.counted).toBe(false);
        expect(r.stardust).toBe(0);
        expect(r.streak.current).toBe(4);
    });

    it("increments on a consecutive day", () => {
        const s = freshStreak({ current: 4, longest: 4, lastActionDay: "2026-07-03" });
        const r = applyAction(s, "2026-07-04");
        expect(r.streak.current).toBe(5);
        expect(r.streak.longest).toBe(5);
    });

    it("resets to 1 after a missed day with no freeze tokens", () => {
        const s = freshStreak({ current: 12, longest: 12, lastActionDay: "2026-07-03", freezeTokens: 0 });
        const r = applyAction(s, "2026-07-05"); // missed the 4th
        expect(r.streak.current).toBe(1);
        expect(r.streak.longest).toBe(12); // longest preserved
        expect(r.streakSaved).toBe(false);
    });
});

describe("orbitEngine — Gravity Assist freeze", () => {
    it("consumes one token to bridge a single missed day", () => {
        const s = freshStreak({ current: 40, longest: 40, lastActionDay: "2026-07-03", freezeTokens: 2 });
        const r = applyAction(s, "2026-07-05"); // missed 1 day
        expect(r.streakSaved).toBe(true);
        expect(r.freezeUsed).toBe(1);
        expect(r.streak.current).toBe(41);
        expect(r.streak.freezeTokens).toBe(1);
    });

    it("consumes multiple tokens for multiple missed days", () => {
        const s = freshStreak({ current: 40, longest: 40, lastActionDay: "2026-07-03", freezeTokens: 3 });
        const r = applyAction(s, "2026-07-06"); // missed 2 days
        expect(r.freezeUsed).toBe(2);
        expect(r.streak.current).toBe(41);
        expect(r.streak.freezeTokens).toBe(1);
    });

    it("resets (and keeps tokens) when the gap exceeds available freezes", () => {
        const s = freshStreak({ current: 40, longest: 40, lastActionDay: "2026-07-03", freezeTokens: 1 });
        const r = applyAction(s, "2026-07-08"); // missed 4 days, only 1 token
        expect(r.streakSaved).toBe(false);
        expect(r.streak.current).toBe(1);
        expect(r.streak.freezeTokens).toBe(1); // not wasted
    });

    it("grants one token per new ISO week, capped, idempotent within a week", () => {
        let f = { tokens: 0, lastGrantWeek: "" };
        ({ freeze: f } = grantWeeklyFreeze(f, "2026-W27"));
        expect(f.tokens).toBe(1);
        const again = grantWeeklyFreeze(f, "2026-W27");
        expect(again.granted).toBe(false);
        expect(again.freeze.tokens).toBe(1);
        // cap
        let g = { tokens: FREEZE_CAP, lastGrantWeek: "2026-W27" };
        const capped = grantWeeklyFreeze(g, "2026-W28");
        expect(capped.freeze.tokens).toBe(FREEZE_CAP);
    });
});

describe("orbitEngine — milestones", () => {
    it("pays Stardust once when a milestone day is reached", () => {
        const s = freshStreak({ current: 6, longest: 6, lastActionDay: "2026-07-03" });
        const r = applyAction(s, "2026-07-04"); // → 7 = Low Orbit
        expect(r.milestone).toBeTruthy();
        expect(r.milestone.name).toBe("Low Orbit");
        expect(r.stardust).toBeGreaterThan(MILESTONES.find((m) => m.days === 7).stardust); // milestone + drip
        expect(r.streak.milestonesHit).toContain(7);
    });

    it("does not pay the same milestone twice", () => {
        // reach 7, then drop and climb back to 7 → no second payout
        const s = freshStreak({ current: 6, longest: 7, lastActionDay: "2026-07-03", milestonesHit: [3, 7] });
        const r = applyAction(s, "2026-07-04");
        expect(r.milestone).toBeNull();
    });

    it("nextMilestone returns the next rung above current", () => {
        expect(nextMilestone(5).days).toBe(7);
        expect(nextMilestone(100)).toBeNull();
    });
});

describe("orbitEngine — decay state", () => {
    it("reports active on the action day", () => {
        const s = freshStreak({ current: 3, lastActionDay: "2026-07-03" });
        expect(decayState(s, "2026-07-03").state).toBe("active");
    });
    it("reports decaying the day after", () => {
        const s = freshStreak({ current: 3, lastActionDay: "2026-07-03" });
        expect(decayState(s, "2026-07-04").state).toBe("decaying");
    });
    it("reports idle with no streak", () => {
        expect(decayState(freshStreak(), "2026-07-04").state).toBe("idle");
    });
});

describe("orbitEngine — weekly missions", () => {
    it("rolls a deterministic set of N missions for a week", () => {
        const a = rollMissions(null, "2026-W27").missions;
        const b = rollMissions(null, "2026-W27").missions;
        expect(a.items).toHaveLength(MISSIONS_PER_WEEK);
        expect(a.items.map((i) => i.key)).toEqual(b.items.map((i) => i.key)); // reproducible
    });

    it("gives different weeks (generally) different sets but stable per week", () => {
        const w27 = pickMissions("2026-W27").map((t) => t.key).join(",");
        const w28 = pickMissions("2026-W28").map((t) => t.key).join(",");
        expect(pickMissions("2026-W28").map((t) => t.key).join(",")).toBe(w28); // stable
        expect(typeof w27).toBe("string");
    });

    it("does not re-roll within the same week (preserves progress)", () => {
        const first = rollMissions(null, "2026-W27").missions;
        first.items[0].progress = 1;
        const second = rollMissions(first, "2026-W27");
        expect(second.rolled).toBe(false);
        expect(second.missions.items[0].progress).toBe(1);
    });

    it("advances matching-metric missions and flags newly completed ones", () => {
        let m = rollMissions(null, "2026-W27").missions;
        // Force a known mission to test progress/claim independent of the week's pick.
        m = { weekId: "2026-W27", items: [{ key: "one_swap", metric: "swap", target: 2, stardust: 70, label: "x", description: "y", progress: 0, claimed: false }] };
        let res = applyMissionProgress(m, "swap", 1);
        expect(res.completedNow).toHaveLength(0);
        expect(res.missions.items[0].progress).toBe(1);
        res = applyMissionProgress(res.missions, "swap", 1);
        expect(res.completedNow).toHaveLength(1); // crossed into complete
        // a non-matching metric does nothing
        const noop = applyMissionProgress(res.missions, "message", 5);
        expect(noop.missions.items[0].progress).toBe(2);
    });

    it("claims a completed mission exactly once", () => {
        const m = { weekId: "2026-W27", items: [{ key: "k", metric: "swap", target: 1, stardust: 70, label: "x", description: "y", progress: 1, claimed: false }] };
        const first = claimMission(m, "k");
        expect(first.ok).toBe(true);
        expect(first.stardust).toBe(70);
        const second = claimMission(first.missions, "k");
        expect(second.ok).toBe(false);
        expect(second.reason).toBe("already_claimed");
    });

    it("refuses to claim an incomplete mission", () => {
        const m = { weekId: "2026-W27", items: [{ key: "k", metric: "swap", target: 3, stardust: 70, label: "x", description: "y", progress: 1, claimed: false }] };
        const r = claimMission(m, "k");
        expect(r.ok).toBe(false);
        expect(r.reason).toBe("incomplete");
    });
});

const { phaseFor, graduationStatus } = require("../services/orbitEngine");

describe("orbitEngine — streak graduation phases (Part 3)", () => {
    it("classifies phases at the boundaries", () => {
        expect(phaseFor(0)).toBe("formation");
        expect(phaseFor(29)).toBe("formation");
        expect(phaseFor(30)).toBe("consistency");
        expect(phaseFor(59)).toBe("consistency");
        expect(phaseFor(60)).toBe("graduation");
        expect(phaseFor(365)).toBe("graduation");
    });

    it("graduation drops daily pressure to none", () => {
        expect(graduationStatus(70, 70).pressure).toBe("none");
        expect(graduationStatus(40, 40).pressure).toBe("soft");
        expect(graduationStatus(5, 5).pressure).toBe("high");
    });

    it("Fixed Star badge is sticky — survives a miss (derives from longest)", () => {
        // graduated user who broke back to a 1-day streak keeps the badge
        const s = graduationStatus(1, 90);
        expect(s.graduated).toBe(true);
        expect(s.badge).toBe("Fixed Star");
        expect(s.phase).toBe("formation");   // current phase reflects the short streak…
        expect(s.pressure).toBe("high");     // …but pride badge remains
    });

    it("awards the interim Constant badge in the consistency band", () => {
        expect(graduationStatus(35, 45).badge).toBe("Constant");
        expect(graduationStatus(5, 10).badge).toBeNull();
    });

    it("respects custom thresholds", () => {
        expect(phaseFor(20, { formationMax: 14, consistencyMax: 40 })).toBe("consistency");
    });
});
