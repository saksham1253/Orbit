/**
 * shopController.js — the Stardust Cosmetics Shop API (Orbit Engine, Tier 3).
 * GET the catalog + the viewer's balance/owned/equipped; buy an item (spends
 * Stardust); equip/unequip an owned item. Purchase rules are delegated to the
 * pure reducers in services/cosmeticsCatalog.js.
 */

const User = require("../models/user");
const shop = require("../services/cosmeticsCatalog");

// Shape the shop payload from a user's orbit sub-doc.
function shapeShop(orbit) {
    const cosmetics = shop.normalizeCosmetics(orbit && orbit.cosmetics);
    const stardust = (orbit && orbit.stardust) || 0;
    return {
        // Part 0: `photons` canonical, `stardust` kept for the compat window.
        photons: stardust,
        stardust,
        owned: cosmetics.owned,
        equipped: { name_glow: cosmetics.nameGlow, background: cosmetics.background },
        catalog: shop.CATALOG.map((c) => ({
            ...c,
            owned: cosmetics.owned.includes(c.key),
            equipped: cosmetics.nameGlow === c.key || cosmetics.background === c.key,
            affordable: stardust >= c.cost,
        })),
    };
}

// GET /api/orbit/shop
exports.getShop = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("orbit.cosmetics orbit.stardust").lean();
        if (!user) return res.status(404).json({ message: "User not found" });
        return res.status(200).json(shapeShop(user.orbit));
    } catch (err) {
        console.error("getShop error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// POST /api/orbit/shop/buy { key }
exports.buy = async (req, res) => {
    try {
        const { key } = req.body || {};
        if (!key) return res.status(400).json({ message: "key is required" });

        const user = await User.findById(req.user.id).select("orbit.cosmetics orbit.stardust").lean();
        if (!user) return res.status(404).json({ message: "User not found" });

        const result = shop.applyPurchase(
            { stardust: (user.orbit && user.orbit.stardust) || 0, cosmetics: user.orbit && user.orbit.cosmetics },
            key
        );
        if (!result.ok) {
            const msg = result.reason === "insufficient" ? "Not enough Stardust"
                : result.reason === "already_owned" ? "You already own this"
                : "Item not found";
            return res.status(400).json({ message: msg, reason: result.reason });
        }

        await User.updateOne(
            { _id: req.user.id },
            { $set: { "orbit.stardust": result.stardust, "orbit.cosmetics.owned": result.cosmetics.owned } }
        );

        const fresh = await User.findById(req.user.id).select("orbit.cosmetics orbit.stardust").lean();
        require("../services/orbitAnalytics").track("cosmetic.purchase", { userId: String(req.user.id), key, spent: result.item.cost });
        require("../services/photonLedger").record(req.user.id, -result.item.cost, "cosmetic"); // C6 sink (once)
        return res.status(200).json({ bought: key, spent: result.item.cost, spentPhotons: result.item.cost, ...shapeShop(fresh.orbit) });
    } catch (err) {
        console.error("buy (shop) error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// POST /api/orbit/shop/equip { type, key }   (key = null → unequip)
exports.equip = async (req, res) => {
    try {
        const { type, key = null } = req.body || {};
        const user = await User.findById(req.user.id).select("orbit.cosmetics").lean();
        if (!user) return res.status(404).json({ message: "User not found" });

        const result = shop.applyEquip({ cosmetics: user.orbit && user.orbit.cosmetics }, type, key);
        if (!result.ok) {
            const msg = result.reason === "not_owned" ? "You don't own this yet"
                : result.reason === "bad_type" ? "Invalid cosmetic type"
                : "Item not found";
            return res.status(400).json({ message: msg, reason: result.reason });
        }

        await User.updateOne(
            { _id: req.user.id },
            { $set: {
                "orbit.cosmetics.nameGlow": result.cosmetics.nameGlow,
                "orbit.cosmetics.background": result.cosmetics.background,
            } }
        );

        const fresh = await User.findById(req.user.id).select("orbit.cosmetics orbit.stardust").lean();
        return res.status(200).json(shapeShop(fresh.orbit));
    } catch (err) {
        console.error("equip (shop) error:", err);
        res.status(500).json({ message: "Server error" });
    }
};
