const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const User = require("../models/user");
const prog = require("../controllers/adminProgressionController");

function mockRes() {
    return { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
}
const adminReq = (over = {}) => ({ body: {}, params: {}, headers: {}, adminUser: { _id: new mongoose.Types.ObjectId(), email: "admin@test" }, ...over });

let mongoServer;
beforeAll(async () => { mongoServer = await MongoMemoryServer.create(); await mongoose.connect(mongoServer.getUri()); });
afterAll(async () => { await mongoose.disconnect(); await mongoServer.stop(); });
afterEach(async () => { for (const k in mongoose.connection.collections) await mongoose.connection.collections[k].deleteMany(); });

describe("adminProgression support tools — touch orbit only, never rank", () => {
    it("adjustStreak sets current/longest and leaves cosmic.score untouched", async () => {
        const u = await User.create({ name: "S", email: "s@test.com", password: "password123", orbit: { streak: { current: 5, longest: 9 } }, cosmic: { score: 500, tierId: "star_3" } });
        const res = mockRes();
        await prog.adjustStreak(adminReq({ params: { id: String(u._id) }, body: { current: 20, reason: "restore after outage" } }), res);
        expect(res.statusCode).toBe(200);
        const after = await User.findById(u._id).select("orbit.streak cosmic.score cosmic.tierId").lean();
        expect(after.orbit.streak.current).toBe(20);
        expect(after.orbit.streak.longest).toBe(20); // bumped since 20 > 9
        expect(after.cosmic.score).toBe(500);         // rank UNCHANGED
        expect(after.cosmic.tierId).toBe("star_3");
    });

    it("grantFreeze adds tokens (bounded) and leaves rank untouched", async () => {
        const u = await User.create({ name: "F", email: "f@test.com", password: "password123", orbit: { freeze: { tokens: 1 } }, cosmic: { score: 300 } });
        const res = mockRes();
        await prog.grantFreeze(adminReq({ params: { id: String(u._id) }, body: { tokens: 2, reason: "goodwill" } }), res);
        expect(res.statusCode).toBe(200);
        const after = await User.findById(u._id).select("orbit.freeze cosmic.score").lean();
        expect(after.orbit.freeze.tokens).toBe(3);
        expect(after.cosmic.score).toBe(300); // rank UNCHANGED
    });

    it("requires a reason and rejects an out-of-range streak", async () => {
        const u = await User.create({ name: "R", email: "r@test.com", password: "password123" });
        const r1 = mockRes();
        await prog.adjustStreak(adminReq({ params: { id: String(u._id) }, body: { current: 10 } }), r1);
        expect(r1.statusCode).toBe(400);
        const r2 = mockRes();
        await prog.adjustStreak(adminReq({ params: { id: String(u._id) }, body: { current: -1, reason: "x" } }), r2);
        expect(r2.statusCode).toBe(400);
    });
});
