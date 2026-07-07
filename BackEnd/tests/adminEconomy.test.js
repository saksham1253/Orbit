const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const User = require("../models/user");
const PhotonLedger = require("../models/PhotonLedger");
const economy = require("../controllers/adminEconomyController");

// Minimal mock res that captures status + json.
function mockRes() {
    return {
        statusCode: 200,
        body: null,
        status(c) { this.statusCode = c; return this; },
        json(b) { this.body = b; return this; },
    };
}
const adminReq = (body) => ({
    body,
    adminUser: { _id: new mongoose.Types.ObjectId(), email: "admin@test" },
    headers: {},
});

// photonLedger.record is fire-and-forget; poll briefly for the async write.
async function waitForLedger(userId, n = 1, tries = 40) {
    for (let i = 0; i < tries; i++) {
        const rows = await PhotonLedger.find({ userId }).lean();
        if (rows.length >= n) return rows;
        await new Promise((r) => setTimeout(r, 15));
    }
    return PhotonLedger.find({ userId }).lean();
}

let mongoServer;
beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
});
afterAll(async () => { await mongoose.disconnect(); await mongoServer.stop(); });
afterEach(async () => {
    for (const key in mongoose.connection.collections) await mongoose.connection.collections[key].deleteMany();
});

describe("adminEconomyController.adjust — INVARIANT: Photons never touch rank", () => {
    it("a grant changes the balance + writes a ledger row, but leaves cosmic.score/tierId untouched", async () => {
        const u = await User.create({
            name: "Ranked User", email: "ranked@test.com", password: "password123",
            orbit: { stardust: 100 }, cosmic: { score: 777, tierId: "nebula_5" },
        });

        const res = mockRes();
        await economy.adjust(adminReq({ userId: String(u._id), amount: 250, reason: "promo comp" }), res);

        expect(res.statusCode).toBe(200);
        expect(res.body.applied).toBe(250);

        const after = await User.findById(u._id).select("orbit.stardust cosmic.score cosmic.tierId").lean();
        expect(after.orbit.stardust).toBe(350);          // balance changed
        expect(after.cosmic.score).toBe(777);            // rank UNCHANGED
        expect(after.cosmic.tierId).toBe("nebula_5");    // tier UNCHANGED

        const ledger = await waitForLedger(u._id, 1);
        expect(ledger).toHaveLength(1);
        expect(ledger[0].delta).toBe(250);
        expect(ledger[0].source).toBe("admin_grant");
    });

    it("a deduction floors the balance at 0 and records the real applied delta", async () => {
        const u = await User.create({ name: "Low", email: "low@test.com", password: "password123", orbit: { stardust: 30 } });
        const res = mockRes();
        await economy.adjust(adminReq({ userId: String(u._id), amount: -100, reason: "clawback" }), res);
        expect(res.body.after).toBe(0);
        expect(res.body.applied).toBe(-30); // only 30 could be removed
        const after = await User.findById(u._id).select("orbit.stardust").lean();
        expect(after.orbit.stardust).toBe(0);
    });

    it("rejects a missing reason (audited action) and a zero amount", async () => {
        const u = await User.create({ name: "R", email: "r@test.com", password: "password123", orbit: { stardust: 10 } });
        const r1 = mockRes();
        await economy.adjust(adminReq({ userId: String(u._id), amount: 50 }), r1);
        expect(r1.statusCode).toBe(400);
        const r2 = mockRes();
        await economy.adjust(adminReq({ userId: String(u._id), amount: 0, reason: "x" }), r2);
        expect(r2.statusCode).toBe(400);
    });
});
