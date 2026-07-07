/**
 * cosmeticsCatalog.js — the Stardust shop catalog + pure buy/equip reducers
 * (Orbit Engine, Tier 3). The REDUCERS stay pure (functions over a { stardust,
 * cosmetics } state) and unit-testable. The CATALOG DATA is now cache-backed:
 * DEFAULT_CATALOG below is the seed/fallback, and when the admin StoreItem
 * collection is non-empty it overlays the cache (loaded via refresh(), same
 * pattern as flagStore/configStore). An un-seeded install behaves EXACTLY as
 * before (cache == defaults), so the pure-reducer tests still pass with no DB.
 *
 * Render metadata (the CSS glow/gradient) lives on the FRONTEND
 * (cosmic/cosmetics.js) keyed by the same `key`; the server only owns the
 * economy (key, type, cost, ownership).
 */

// type: "name_glow" | "background". `rarity` keys match the frontend 15-tier
// ladder (cosmic/rarity.js); `category` groups items into the store tabs.
// This is the DEFAULT catalog — the seed + fallback when no StoreItem rows exist.
const DEFAULT_CATALOG = Object.freeze([
    // ── Name glows (Identity) ───────────────────────────────────────────────
    { key: "glow_aurora",   type: "name_glow", name: "Aurora Glow",    cost: 300,  hint: "Teal–green shimmer on your name",  rarity: "COSMIC",      category: "identity" },
    { key: "glow_ember",    type: "name_glow", name: "Ember Glow",     cost: 300,  hint: "Warm orange flicker",              rarity: "STELLAR",     category: "identity" },
    { key: "glow_plasma",   type: "name_glow", name: "Plasma Glow",    cost: 600,  hint: "Magenta–violet pulse",             rarity: "COSMIC",      category: "identity" },
    { key: "glow_gold",     type: "name_glow", name: "Solar Gold",     cost: 900,  hint: "Radiant gold",                     rarity: "HYPERNOVA",   category: "identity" },
    { key: "glow_void",     type: "name_glow", name: "Void Glow",      cost: 1200, hint: "Iridescent dark shimmer",          rarity: "SINGULARITY", category: "identity" },

    // ── Profile backgrounds / nebulae (Themes) ──────────────────────────────
    { key: "bg_nebula_violet", type: "background", name: "Violet Nebula", cost: 400,  hint: "Deep violet profile cloud",   rarity: "STELLAR",   category: "themes" },
    { key: "bg_nebula_teal",   type: "background", name: "Teal Nebula",   cost: 400,  hint: "Cyan–teal profile cloud",     rarity: "STELLAR",   category: "themes" },
    { key: "bg_deep_field",    type: "background", name: "Deep Field",    cost: 700,  hint: "Distant galaxies",            rarity: "COSMIC",    category: "themes" },
    { key: "bg_supernova",     type: "background", name: "Supernova",     cost: 1500, hint: "Blazing core burst",          rarity: "HYPERNOVA", category: "themes" },
]);

// Back-compat: CATALOG remains the DEFAULT array (used by tests + as the seed).
const CATALOG = DEFAULT_CATALOG;

const TYPES = Object.freeze(["name_glow", "background"]);
// Which equipped-slot each type maps to on user.orbit.cosmetics.
const SLOT = Object.freeze({ name_glow: "nameGlow", background: "background" });

// ── Live catalog cache (defaults seed; StoreItem overlay via refresh) ─────────
// Defaults have no status → treated as "live". The cache holds ALL items (any
// status) so getItem resolves owned-but-archived items for equip; getLiveCatalog
// filters to purchasable ones for the shop.
const withStatus = (c) => ({ status: "live", discountPct: 0, ...c });
let _effective = DEFAULT_CATALOG.map(withStatus);
let _byKey = new Map(_effective.map((c) => [c.key, c]));

const getItem = (key) => _byKey.get(key) || null;

/** All cached items (admin view). */
function getAllCatalog() { return _effective.slice(); }

/** Purchasable items for the user shop: live + inside any availability window. */
function getLiveCatalog(now = Date.now()) {
    return _effective.filter((c) => {
        if (c.status && c.status !== "live") return false;
        if (c.availableFrom && new Date(c.availableFrom).getTime() > now) return false;
        if (c.availableTo && new Date(c.availableTo).getTime() < now) return false;
        return true;
    });
}

/** Rebuild the cache from an array of item-shaped rows (or reset to defaults). */
function _load(rows) {
    _effective = (rows && rows.length ? rows : DEFAULT_CATALOG).map(withStatus);
    _byKey = new Map(_effective.map((c) => [c.key, c]));
}

/** Refresh the cache from the StoreItem collection. Empty collection → defaults. */
async function refresh() {
    try {
        const StoreItem = require("../models/StoreItem");
        const rows = await StoreItem.find().sort({ sortOrder: 1, createdAt: 1 }).lean();
        _load(rows.map((r) => ({
            key: r.key, type: r.type, name: r.name, hint: r.hint, cost: r.cost,
            rarity: r.rarity, category: r.category, status: r.status,
            discountPct: r.discountPct || 0, stock: r.stock,
            availableFrom: r.availableFrom, availableTo: r.availableTo,
        })));
    } catch (_) { /* keep previous cache (defaults) */ }
}

let _timer = null;
/** Call once after DB connect. Loads the catalog, then refreshes every `ms`. */
function startAutoRefresh(ms = 15000) {
    refresh();
    if (_timer) clearInterval(_timer);
    _timer = setInterval(refresh, ms);
    if (_timer.unref) _timer.unref();
}

function normalizeCosmetics(c = {}) {
    return {
        owned: Array.isArray(c && c.owned) ? [...c.owned] : [],
        nameGlow: (c && c.nameGlow) || null,
        background: (c && c.background) || null,
    };
}

/**
 * applyPurchase — pure buy. Validates the key exists, isn't already owned, and
 * is affordable; on success returns new { stardust, cosmetics } with the item
 * added to `owned` and Stardust deducted.
 *
 * @returns {{ ok, reason?, stardust, cosmetics, item? }}
 */
function applyPurchase(state, key) {
    const item = getItem(key);
    const cosmetics = normalizeCosmetics(state.cosmetics);
    const stardust = state.stardust || 0;

    if (!item) return { ok: false, reason: "not_found", stardust, cosmetics };
    if (cosmetics.owned.includes(key)) return { ok: false, reason: "already_owned", stardust, cosmetics };
    if (stardust < item.cost) return { ok: false, reason: "insufficient", stardust, cosmetics };

    cosmetics.owned.push(key);
    return { ok: true, stardust: stardust - item.cost, cosmetics, item };
}

/**
 * applyEquip — pure equip/unequip. `key = null` clears the slot for `type`.
 * A non-null key must reference an owned item of the matching type.
 *
 * @returns {{ ok, reason?, cosmetics }}
 */
function applyEquip(state, type, key) {
    const cosmetics = normalizeCosmetics(state.cosmetics);
    if (!TYPES.includes(type)) return { ok: false, reason: "bad_type", cosmetics };
    const slot = SLOT[type];

    if (key == null) { cosmetics[slot] = null; return { ok: true, cosmetics }; } // unequip

    const item = getItem(key);
    if (!item || item.type !== type) return { ok: false, reason: "not_found", cosmetics };
    if (!cosmetics.owned.includes(key)) return { ok: false, reason: "not_owned", cosmetics };

    cosmetics[slot] = key;
    return { ok: true, cosmetics };
}

module.exports = {
    CATALOG, DEFAULT_CATALOG, TYPES, SLOT,
    getItem, getAllCatalog, getLiveCatalog, normalizeCosmetics, applyPurchase, applyEquip,
    refresh, startAutoRefresh,
};
