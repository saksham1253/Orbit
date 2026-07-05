const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { buildDemoOrbit, seedDemoAccount, warp, teardown } = require("../services/orbitSeeder");
const User = require("../models/user");
const Skill = require("../models/skill");
const Constellation = require("../models/Constellation");
const Connection = require("../models/Connection");
const SeedLedger = require("../models/SeedLedger");

const NOW = new Date("2026-07-06T12:00:00Z"); // fixed clock (Date.UTC math only)

// ── Pure builder (no DB) ─────────────────────────────────────────────────────
describe("orbitSeeder.buildDemoOrbit — faithful engine replay", () => {
    it("produces a real 60-day graduated streak with the exact milestones + Photons", () => {
        const { orbit, summary } = buildDemoOrbit(NOW);
        expect(orbit.streak.current).toBe(60);
        expect(orbit.streak.longest).toBe(60);
        // milestones an organic 60-day streak would have paid (100 not yet reached)
        expect(orbit.streak.milestonesHit).toEqual([3, 7, 14, 30, 60]);
        // 60 daily drips (5 each) + milestone payouts 20+60+120+300+700
        expect(orbit.stardust).toBe(60 * 5 + (20 + 60 + 120 + 300 + 700));
        expect(summary.graduated).toBe(true);
        expect(orbit.streak.lastActionDay).toBe("2026-07-06");
    });

    it("layers a claimable mission, a weekly freeze, league placement and cosmetics", () => {
        const { orbit } = buildDemoOrbit(NOW);
        expect(orbit.freeze.tokens).toBeGreaterThanOrEqual(1);
        expect(orbit.missions.items.some((m) => m.progress >= m.target)).toBe(true); // claimable
        expect(orbit.league.divisionId).toBe("star_cluster");
        expect(orbit.league.groupId).toMatch(/^star_cluster:2026-W\d\d:0$/);
        expect(orbit.cosmetics.owned.length).toBe(2);
        expect(orbit.cosmetics.nameGlow).toBeTruthy();
        expect(orbit.cosmetics.background).toBeTruthy();
    });

    it("is deterministic for a given clock", () => {
        expect(buildDemoOrbit(NOW).orbit).toEqual(buildDemoOrbit(NOW).orbit);
    });
});

// ── DB round-trip ────────────────────────────────────────────────────────────
describe("orbitSeeder — seed → warp → teardown (DB)", () => {
    let mongoServer, userId;
    beforeAll(async () => {
        mongoServer = await MongoMemoryServer.create();
        await mongoose.connect(mongoServer.getUri());
    });
    afterAll(async () => { await mongoose.disconnect(); await mongoServer.stop(); });
    beforeEach(async () => {
        const u = await User.create({ name: "Demo", email: "demo@orbit.test", password: "x".repeat(20) });
        userId = u._id;
    });
    afterEach(async () => {
        const cs = mongoose.connection.collections;
        for (const k in cs) await cs[k].deleteMany();
    });

    it("seeds all tiers + a partner-bot, rivals, mastery skills and a completed session", async () => {
        const { seedRunId, summary } = await seedDemoAccount({ userId, now: NOW, rivals: 5 });
        expect(seedRunId).toBeTruthy();
        expect(summary.graduated).toBe(true);

        const u = await User.findById(userId).lean();
        expect(u.orbit.streak.current).toBe(60);
        expect(u.orbit.cosmetics.owned.length).toBe(2);

        // partner-bot + active constellation
        const con = await Constellation.findOne({ members: userId, status: "active" }).lean();
        expect(con).toBeTruthy();
        expect(con.streak.current).toBeGreaterThan(0);

        // rivals share the user's league group
        const rivals = await User.countDocuments({ "orbit.league.groupId": u.orbit.league.groupId, _id: { $ne: userId } });
        expect(rivals).toBe(5);

        // mastery skills + a completed session
        expect(await Skill.countDocuments({ userId })).toBe(3);
        expect(await Connection.countDocuments({ status: "completed", receiver: userId })).toBe(1);

        // ledger recorded
        const ledger = await SeedLedger.findOne({ seedRunId }).lean();
        expect(ledger.refs.length).toBeGreaterThan(0);
    });

    it("warp 'miss' on a graduated streak keeps the Fixed Star (B3)", async () => {
        await seedDemoAccount({ userId, now: NOW, rivals: 2 });
        const r = await warp({ userId, op: "miss", now: NOW });
        expect(r.badge).toBe("Fixed Star");   // sticky from longest, survives a miss
    });

    it("warp 'rollover' promotes/relegates the group deterministically (B2)", async () => {
        await seedDemoAccount({ userId, now: NOW, rivals: 12 });
        const r = await warp({ userId, op: "rollover", now: NOW });
        expect(r.op).toBe("rollover");
        expect(r.groupSize).toBe(13); // user + 12 rivals
        expect((r.promoted || 0) + (r.relegated || 0) + (r.held || 0)).toBe(13);
    });

    it("teardown removes every seeded doc and restores the prior orbit", async () => {
        const before = await User.findById(userId).lean();
        const { seedRunId } = await seedDemoAccount({ userId, now: NOW, rivals: 5 });

        const res = await teardown({ seedRunId });
        expect(res.removed).toBeGreaterThan(0);
        expect(res.restored).toBe(true);

        // all seeded docs gone
        expect(await User.countDocuments({ email: /@orbit\.seed$/ })).toBe(0);
        expect(await Constellation.countDocuments()).toBe(0);
        expect(await Skill.countDocuments({ userId })).toBe(0);
        expect(await Connection.countDocuments()).toBe(0);
        expect(await SeedLedger.countDocuments()).toBe(0);

        // target user's orbit restored to what it was pre-seed
        const after = await User.findById(userId).lean();
        expect(after.orbit.streak.current).toBe(before.orbit?.streak?.current || 0);
    });
});
