const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const store = require("../services/flagStore");
const FeatureFlag = require("../models/FeatureFlag");
const orbitFlags = require("../services/orbitFlags");

describe("flagStore — defaults without DB", () => {
    it("returns env/registry defaults synchronously (tiers ON, cap=3)", () => {
        expect(store.get("ORBIT_TIER2")).toBe(true);
        expect(store.get("ORBIT_TIER2_PCT")).toBe(100);
        expect(store.get("ORBIT_MSG_XP_CAP")).toBe(3);
    });
    it("coerces types", () => {
        expect(store.coerce("false", "bool")).toBe(false);
        expect(store.coerce("250", "pct")).toBe(100);   // clamped
        expect(store.coerce("7", "int")).toBe(7);
    });
    it("rejects unknown flags on set", async () => {
        await expect(store.set("NOPE", true)).rejects.toThrow(/unknown flag/);
    });
});

describe("flagStore — live override (DB) drives orbitFlags", () => {
    let mongoServer;
    beforeAll(async () => {
        mongoServer = await MongoMemoryServer.create();
        await mongoose.connect(mongoServer.getUri());
    });
    afterAll(async () => {
        // restore defaults so other suites see a clean cache
        await FeatureFlag.deleteMany({});
        await store.refresh();
        await mongoose.disconnect();
        await mongoServer.stop();
    });

    it("a persisted override flips the live value + gates the tier without redeploy", async () => {
        expect(orbitFlags.tierEnabledFor("tier2", "user-x")).toBe(true);

        await store.set("ORBIT_TIER2", false, "admin@test");   // write-through
        expect(store.get("ORBIT_TIER2")).toBe(false);
        expect(orbitFlags.tierEnabledFor("tier2", "user-x")).toBe(false); // live!

        // a fresh instance picks it up via refresh()
        store.get("ORBIT_TIER2"); // cached
        await store.set("ORBIT_TIER2", true, "admin@test");
        await store.refresh();
        expect(store.get("ORBIT_TIER2")).toBe(true);
    });

    it("list() reports overridden flags with meta", async () => {
        await store.set("ORBIT_TIER3_PCT", 10, "admin@test");
        const list = await store.list();
        const row = list.find((f) => f.key === "ORBIT_TIER3_PCT");
        expect(row.value).toBe(10);
        expect(row.overridden).toBe(true);
        expect(row.default).toBe(100);
    });
});
