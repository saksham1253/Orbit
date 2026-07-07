const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const catalog = require("../services/cosmeticsCatalog");
const StoreItem = require("../models/StoreItem");
const store = require("../controllers/adminStoreController");

function mockRes() {
    return { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
}
const adminReq = (over = {}) => ({ body: {}, params: {}, query: {}, headers: {}, adminUser: { _id: new mongoose.Types.ObjectId(), email: "admin@test" }, ...over });

describe("rarity collision guardrail (pure)", () => {
    it("rejects milestone/league names, allows real tier names", () => {
        expect(store.collides("Deep Space")).toBe(true);   // streak milestone
        expect(store.collides("galaxy")).toBe(true);        // league division (case-insensitive)
        expect(store.collides("Multiversal")).toBe(false);  // legit tier
        expect(store.collides("Lunar")).toBe(false);
    });
});

describe("cosmeticsCatalog cache — defaults with no DB", () => {
    it("getLiveCatalog returns the 9 default items when the collection is empty", () => {
        const live = catalog.getLiveCatalog();
        expect(live.length).toBe(catalog.DEFAULT_CATALOG.length);
        expect(catalog.getItem("glow_void")).toBeTruthy();
    });
});

describe("StoreItem overlay + admin CRUD (DB)", () => {
    let mongoServer;
    beforeAll(async () => { mongoServer = await MongoMemoryServer.create(); await mongoose.connect(mongoServer.getUri()); });
    afterAll(async () => { await StoreItem.deleteMany({}); await catalog.refresh(); await mongoose.disconnect(); await mongoServer.stop(); });
    afterEach(async () => { await StoreItem.deleteMany({}); await catalog.refresh(); });

    it("a created LIVE item overlays the cache and shows in getLiveCatalog", async () => {
        const res = mockRes();
        await store.createItem(adminReq({ body: { key: "glow_nova", type: "name_glow", name: "Nova", cost: 250, rarity: "COSMIC", category: "identity", status: "live" } }), res);
        expect(res.statusCode).toBe(200);
        // createItem calls catalog.refresh() internally
        expect(catalog.getItem("glow_nova")).toBeTruthy();
        expect(catalog.getLiveCatalog().some((c) => c.key === "glow_nova")).toBe(true);
    });

    it("a DRAFT item resolves via getItem (for equip) but is NOT in the live shop", async () => {
        await StoreItem.create({ key: "glow_secret", type: "name_glow", name: "Secret", cost: 500, status: "draft" });
        await catalog.refresh();
        expect(catalog.getItem("glow_secret")).toBeTruthy();                       // equip can resolve it
        expect(catalog.getLiveCatalog().some((c) => c.key === "glow_secret")).toBe(false); // shop hides it
    });

    it("rejects a duplicate key and a bad key format", async () => {
        await StoreItem.create({ key: "glow_dupe", type: "name_glow", name: "Dupe", cost: 100, status: "live" });
        const r1 = mockRes();
        await store.createItem(adminReq({ body: { key: "glow_dupe", type: "name_glow", name: "x", cost: 1 } }), r1);
        expect(r1.statusCode).toBe(409);
        const r2 = mockRes();
        await store.createItem(adminReq({ body: { key: "Bad Key!", type: "name_glow", name: "x", cost: 1 } }), r2);
        expect(r2.statusCode).toBe(400);
    });

    it("archive flips status and drops the item from the live shop", async () => {
        await StoreItem.create({ key: "glow_temp", type: "name_glow", name: "Temp", cost: 100, status: "live" });
        await catalog.refresh();
        expect(catalog.getLiveCatalog().some((c) => c.key === "glow_temp")).toBe(true);
        const res = mockRes();
        await store.archiveItem(adminReq({ params: { key: "glow_temp" } }), res);
        expect(res.statusCode).toBe(200);
        expect(catalog.getLiveCatalog().some((c) => c.key === "glow_temp")).toBe(false);
    });
});
