/**
 * adminStoreController.js — Nebula Store catalog + Rarity module (spec B + C).
 *
 * Full CRUD over StoreItem (draft → live → archived), rarity-tier management, and
 * per-item analytics (purchases + Photon revenue from the PhotonLedger). All
 * mutations require the "catalog" portal role, are audited, and hot-reload the
 * user-facing catalog cache (cosmeticsCatalog.refresh) so edits apply live.
 *
 * Guardrail (spec C): a rarity tier key must not collide with a streak-milestone
 * or league-division name, so the two namespaces never conflict.
 */
const StoreItem = require("../models/StoreItem");
const RarityTier = require("../models/RarityTier");
const PhotonLedger = require("../models/PhotonLedger");
const User = require("../models/user");
const catalog = require("../services/cosmeticsCatalog");
const { audit } = require("../utils/adminAudit");

// Reserved names the rarity keys/labels must not collide with (spec C guardrail).
const RESERVED = new Set([
    // streak milestones (orbitEngine.MILESTONES)
    "LIFTOFF", "LOW ORBIT", "HIGH ORBIT", "GEOSTATIONARY", "LUNAR TRANSFER", "DEEP SPACE",
    // league divisions (leagueService.DIVISIONS) — generic space names
    "ASTEROID", "COMET", "PLANET", "STAR", "NEBULA", "GALAXY",
]);
const collides = (s) => RESERVED.has(String(s || "").trim().toUpperCase());

const VALID_STATUS = ["draft", "live", "archived"];
const ITEM_FIELDS = ["type", "name", "hint", "cost", "rarity", "category", "status", "stock", "discountPct", "availableFrom", "availableTo", "sortOrder"];

async function reloadCatalog() { try { await catalog.refresh(); } catch { /* best-effort */ } }

// ── Items ─────────────────────────────────────────────────────────────────────

// GET /store/items?status=&category= — all catalog items (admin view).
exports.listItems = async (req, res) => {
    try {
        const filter = {};
        if (VALID_STATUS.includes(req.query.status)) filter.status = req.query.status;
        if (req.query.category) filter.category = req.query.category;
        const rows = await StoreItem.find(filter).sort({ sortOrder: 1, createdAt: 1 }).lean();
        return res.json({ rows });
    } catch (err) {
        console.error("[admin store.listItems]", err.message);
        return res.status(500).json({ message: "Failed to load items." });
    }
};

// POST /store/items — create a new item (starts as draft unless status given).
exports.createItem = async (req, res) => {
    try {
        const b = req.body || {};
        if (!b.key || !/^[a-z0-9_]+$/.test(b.key)) return res.status(400).json({ message: "key is required (lowercase letters, digits, underscore)." });
        if (!b.type || !b.name) return res.status(400).json({ message: "type and name are required." });
        if (!(Number(b.cost) >= 0)) return res.status(400).json({ message: "cost must be a non-negative number." });
        if (await StoreItem.findOne({ key: b.key }).lean()) return res.status(409).json({ message: "An item with that key already exists." });

        const doc = { key: b.key, updatedBy: req.adminUser.email };
        for (const f of ITEM_FIELDS) if (b[f] !== undefined) doc[f] = b[f];
        if (doc.status && !VALID_STATUS.includes(doc.status)) return res.status(400).json({ message: "Invalid status." });
        const created = await StoreItem.create(doc);
        await reloadCatalog();
        await audit(req, { actorId: req.adminUser._id, actorEmail: req.adminUser.email, action: "store.item.create", targetType: "store_item", targetId: created.key, after: created.toObject() });
        return res.json({ ok: true, item: created });
    } catch (err) {
        console.error("[admin store.createItem]", err.message);
        return res.status(500).json({ message: "Create failed." });
    }
};

// PATCH /store/items/:key — update fields (incl. status = draft/live/archived).
exports.updateItem = async (req, res) => {
    try {
        const before = await StoreItem.findOne({ key: req.params.key }).lean();
        if (!before) return res.status(404).json({ message: "Not found" });
        const b = req.body || {};
        const $set = { updatedBy: req.adminUser.email };
        for (const f of ITEM_FIELDS) if (b[f] !== undefined) $set[f] = b[f];
        if ($set.status && !VALID_STATUS.includes($set.status)) return res.status(400).json({ message: "Invalid status." });
        if ($set.cost !== undefined && !(Number($set.cost) >= 0)) return res.status(400).json({ message: "cost must be non-negative." });

        await StoreItem.updateOne({ key: req.params.key }, { $set });
        const after = await StoreItem.findOne({ key: req.params.key }).lean();
        await reloadCatalog();
        await audit(req, { actorId: req.adminUser._id, actorEmail: req.adminUser.email, action: "store.item.update", targetType: "store_item", targetId: req.params.key, before, after });
        return res.json({ ok: true, item: after });
    } catch (err) {
        console.error("[admin store.updateItem]", err.message);
        return res.status(500).json({ message: "Update failed." });
    }
};

// POST /store/items/:key/archive — soft-remove (reversible: set status back to live).
exports.archiveItem = async (req, res) => {
    try {
        const before = await StoreItem.findOne({ key: req.params.key }).lean();
        if (!before) return res.status(404).json({ message: "Not found" });
        await StoreItem.updateOne({ key: req.params.key }, { $set: { status: "archived", updatedBy: req.adminUser.email } });
        await reloadCatalog();
        await audit(req, { actorId: req.adminUser._id, actorEmail: req.adminUser.email, action: "store.item.archive", targetType: "store_item", targetId: req.params.key, before: { status: before.status }, after: { status: "archived" } });
        return res.json({ ok: true });
    } catch (err) {
        console.error("[admin store.archiveItem]", err.message);
        return res.status(500).json({ message: "Archive failed." });
    }
};

// GET /store/items/:key/analytics — purchases + Photon revenue + owners.
exports.itemAnalytics = async (req, res) => {
    try {
        const key = req.params.key;
        const item = await StoreItem.findOne({ key }).lean();
        if (!item) return res.status(404).json({ message: "Not found" });
        const [owners, ledger] = await Promise.all([
            User.countDocuments({ "orbit.cosmetics.owned": key }),
            // Cosmetic spends are ledgered with source "cosmetic"; revenue for a
            // single item is approximated by owners × cost (the ledger doesn't key
            // spend rows by item). Owners is the exact purchase count.
            PhotonLedger.aggregate([{ $match: { source: "cosmetic" } }, { $group: { _id: null, total: { $sum: "$delta" } } }]),
        ]);
        return res.json({
            key,
            purchases: owners,
            revenue: owners * (item.cost || 0),
            allCosmeticSpend: Math.abs(ledger[0]?.total || 0),
        });
    } catch (err) {
        console.error("[admin store.itemAnalytics]", err.message);
        return res.status(500).json({ message: "Analytics failed." });
    }
};

// ── Rarity tiers ────────────────────────────────────────────────────────────

// GET /store/rarity — the 15-tier ladder (admin view, ordered).
exports.listRarity = async (req, res) => {
    try {
        const rows = await RarityTier.find().sort({ order: 1 }).lean();
        return res.json({ rows });
    } catch (err) {
        console.error("[admin store.listRarity]", err.message);
        return res.status(500).json({ message: "Failed to load rarity tiers." });
    }
};

// PATCH /store/rarity/:key — edit a tier (label/color/glow/order/live).
exports.updateRarity = async (req, res) => {
    try {
        const before = await RarityTier.findOne({ key: req.params.key }).lean();
        if (!before) return res.status(404).json({ message: "Not found" });
        const b = req.body || {};
        // Guardrail: label must not collide with streak-milestone / league names.
        if (b.label && collides(b.label)) return res.status(400).json({ message: "Tier label collides with a milestone/league name." });
        const $set = { updatedBy: req.adminUser.email };
        for (const f of ["label", "color", "glow", "order", "card", "iridescent", "live", "blurb"]) if (b[f] !== undefined) $set[f] = b[f];
        await RarityTier.updateOne({ key: req.params.key }, { $set });
        const after = await RarityTier.findOne({ key: req.params.key }).lean();
        await audit(req, { actorId: req.adminUser._id, actorEmail: req.adminUser.email, action: "store.rarity.update", targetType: "rarity_tier", targetId: req.params.key, before, after });
        return res.json({ ok: true, tier: after });
    } catch (err) {
        console.error("[admin store.updateRarity]", err.message);
        return res.status(500).json({ message: "Update failed." });
    }
};

module.exports.collides = collides; // exported for unit testing the guardrail
