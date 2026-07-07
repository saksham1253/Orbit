const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const store = require("../services/configStore");
const economyConfig = require("../services/economyConfig");
const AppConfig = require("../models/AppConfig");

describe("configStore — resolveConfig overlay (pure, no DB)", () => {
    it("returns the JS defaults untouched when there are no overrides", () => {
        const defaults = { A: 1, B: "x", C: [1, 2] };
        expect(store.resolveConfig("nope-namespace", defaults)).toEqual(defaults);
    });
    it("only honors keys present in defaults (a stale override can't inject a key)", () => {
        // No override set, so resolveConfig must equal defaults exactly.
        const out = store.resolveConfig("economy", economyConfig.DEFAULTS);
        expect(Object.keys(out).sort()).toEqual(Object.keys(economyConfig.DEFAULTS).sort());
    });
    it("economyConfig.value falls back to the engine default with no override", () => {
        expect(economyConfig.value("FREEZE_STARDUST_COST")).toBe(economyConfig.DEFAULTS.FREEZE_STARDUST_COST);
    });
});

describe("configStore — live override drives economyConfig (DB)", () => {
    let mongoServer;
    beforeAll(async () => {
        mongoServer = await MongoMemoryServer.create();
        await mongoose.connect(mongoServer.getUri());
    });
    afterAll(async () => {
        await AppConfig.deleteMany({});
        await store.refresh();
        await mongoose.disconnect();
        await mongoServer.stop();
    });

    it("a persisted override flips the effective value without redeploy, and clear() restores it", async () => {
        const def = economyConfig.DEFAULTS.FREEZE_STARDUST_COST;
        expect(economyConfig.value("FREEZE_STARDUST_COST")).toBe(def);

        await store.set("economy", "FREEZE_STARDUST_COST", 999, "admin@test"); // write-through
        expect(economyConfig.value("FREEZE_STARDUST_COST")).toBe(999);

        const rows = economyConfig.list();
        const row = rows.find((r) => r.key === "FREEZE_STARDUST_COST");
        expect(row.value).toBe(999);
        expect(row.overridden).toBe(true);
        expect(row.default).toBe(def);

        await store.clear("economy", "FREEZE_STARDUST_COST"); // restore default
        expect(economyConfig.value("FREEZE_STARDUST_COST")).toBe(def);
    });

    it("refresh() rebuilds the cache from Mongo (cross-replica propagation)", async () => {
        await store.set("economy", "ACTIVE_DAY_STARDUST", 42, "admin@test");
        await store.refresh();
        expect(store.get("economy", "ACTIVE_DAY_STARDUST")).toBe(42);
        await store.clear("economy", "ACTIVE_DAY_STARDUST");
    });
});
