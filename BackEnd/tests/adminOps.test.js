const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const Rating = require("../models/rating");
const SkillCategory = require("../models/SkillCategory");
const User = require("../models/user");
const ops = require("../controllers/adminOpsController");
const trust = require("../controllers/trustController");

function mockRes() {
    return { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
}
const adminReq = (over = {}) => ({ body: {}, params: {}, query: {}, headers: {}, adminUser: { _id: new mongoose.Types.ObjectId(), email: "admin@test" }, ...over });

let mongoServer;
beforeAll(async () => { mongoServer = await MongoMemoryServer.create(); await mongoose.connect(mongoServer.getUri()); });
afterAll(async () => { await mongoose.disconnect(); await mongoServer.stop(); });
afterEach(async () => { for (const k in mongoose.connection.collections) await mongoose.connection.collections[k].deleteMany(); });

describe("adminOps — skill taxonomy CRUD", () => {
    it("creates a category and rejects a bad slug + duplicate", async () => {
        const r1 = mockRes();
        await ops.createCategory(adminReq({ body: { slug: "web-development", label: "Web Development", aliases: "react, frontend" } }), r1);
        expect(r1.statusCode).toBe(200);
        expect(r1.body.category.aliases).toEqual(["react", "frontend"]);

        const r2 = mockRes();
        await ops.createCategory(adminReq({ body: { slug: "Bad Slug", label: "x" } }), r2);
        expect(r2.statusCode).toBe(400);

        const r3 = mockRes();
        await ops.createCategory(adminReq({ body: { slug: "web-development", label: "dupe" } }), r3);
        expect(r3.statusCode).toBe(409);
    });
});

describe("adminOps — review moderation hides from the public listing", () => {
    it("a hidden review is excluded from trustController.getUserRatings", async () => {
        const from = await User.create({ name: "Rater", email: "rater@test.com", password: "password123" });
        const to = await User.create({ name: "Target", email: "target@test.com", password: "password123" });
        const rev = await Rating.create({ fromUser: from._id, toUser: to._id, score: 1, review: "abusive text" });

        // public listing shows it first
        const pub1 = mockRes();
        await trust.getUserRatings({ params: { userId: String(to._id) } }, pub1);
        expect(pub1.body.ratings).toHaveLength(1);

        // admin hides it (reason required)
        const noReason = mockRes();
        await ops.setReviewHidden(true)(adminReq({ params: { id: String(rev._id) }, body: {} }), noReason);
        expect(noReason.statusCode).toBe(400);

        const hidden = mockRes();
        await ops.setReviewHidden(true)(adminReq({ params: { id: String(rev._id) }, body: { reason: "harassment" } }), hidden);
        expect(hidden.statusCode).toBe(200);

        // now the public listing excludes it
        const pub2 = mockRes();
        await trust.getUserRatings({ params: { userId: String(to._id) } }, pub2);
        expect(pub2.body.ratings).toHaveLength(0);

        // restore brings it back
        await ops.setReviewHidden(false)(adminReq({ params: { id: String(rev._id) }, body: {} }), mockRes());
        const pub3 = mockRes();
        await trust.getUserRatings({ params: { userId: String(to._id) } }, pub3);
        expect(pub3.body.ratings).toHaveLength(1);
    });
});
