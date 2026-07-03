const {
    CATALOG, getItem, applyPurchase, applyEquip,
} = require("../services/cosmeticsCatalog");

const state = (over = {}) => ({ stardust: 1000, cosmetics: { owned: [], nameGlow: null, background: null }, ...over });
const GLOW = CATALOG.find((c) => c.type === "name_glow");
const BG = CATALOG.find((c) => c.type === "background");

describe("cosmeticsCatalog — purchase", () => {
    it("buys an affordable, unowned item and deducts Stardust", () => {
        const r = applyPurchase(state({ stardust: GLOW.cost + 50 }), GLOW.key);
        expect(r.ok).toBe(true);
        expect(r.stardust).toBe(50);
        expect(r.cosmetics.owned).toContain(GLOW.key);
        expect(r.item.key).toBe(GLOW.key);
    });

    it("rejects an unknown item", () => {
        const r = applyPurchase(state(), "nope");
        expect(r.ok).toBe(false);
        expect(r.reason).toBe("not_found");
    });

    it("rejects when insufficient Stardust and does not deduct", () => {
        const r = applyPurchase(state({ stardust: GLOW.cost - 1 }), GLOW.key);
        expect(r.ok).toBe(false);
        expect(r.reason).toBe("insufficient");
        expect(r.stardust).toBe(GLOW.cost - 1);
        expect(r.cosmetics.owned).not.toContain(GLOW.key);
    });

    it("rejects re-buying an owned item", () => {
        const r = applyPurchase(state({ cosmetics: { owned: [GLOW.key], nameGlow: null, background: null } }), GLOW.key);
        expect(r.ok).toBe(false);
        expect(r.reason).toBe("already_owned");
    });
});

describe("cosmeticsCatalog — equip", () => {
    it("equips an owned item into its type's slot", () => {
        const r = applyEquip(state({ cosmetics: { owned: [GLOW.key], nameGlow: null, background: null } }), "name_glow", GLOW.key);
        expect(r.ok).toBe(true);
        expect(r.cosmetics.nameGlow).toBe(GLOW.key);
    });

    it("equips a background into the background slot independently", () => {
        const r = applyEquip(state({ cosmetics: { owned: [BG.key], nameGlow: null, background: null } }), "background", BG.key);
        expect(r.ok).toBe(true);
        expect(r.cosmetics.background).toBe(BG.key);
    });

    it("refuses to equip an unowned item", () => {
        const r = applyEquip(state(), "name_glow", GLOW.key);
        expect(r.ok).toBe(false);
        expect(r.reason).toBe("not_owned");
    });

    it("refuses a type/key mismatch", () => {
        const r = applyEquip(state({ cosmetics: { owned: [BG.key], nameGlow: null, background: null } }), "name_glow", BG.key);
        expect(r.ok).toBe(false);
        expect(r.reason).toBe("not_found");
    });

    it("unequips a slot when key is null", () => {
        const r = applyEquip(state({ cosmetics: { owned: [GLOW.key], nameGlow: GLOW.key, background: null } }), "name_glow", null);
        expect(r.ok).toBe(true);
        expect(r.cosmetics.nameGlow).toBeNull();
    });
});

describe("cosmeticsCatalog — catalog integrity", () => {
    it("has unique keys and positive costs", () => {
        const keys = CATALOG.map((c) => c.key);
        expect(new Set(keys).size).toBe(keys.length);
        expect(CATALOG.every((c) => c.cost > 0)).toBe(true);
        expect(CATALOG.every((c) => ["name_glow", "background"].includes(c.type))).toBe(true);
    });
    it("getItem returns null for unknown keys", () => {
        expect(getItem("ghost")).toBeNull();
    });
});
