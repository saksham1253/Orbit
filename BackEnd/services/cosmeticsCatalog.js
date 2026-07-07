/**
 * cosmeticsCatalog.js — the Stardust shop catalog + pure buy/equip reducers
 * (Orbit Engine, Tier 3). NO I/O — the catalog is static data and the reducers
 * are pure functions over a { stardust, cosmetics } state, so purchase rules are
 * unit-testable in isolation (mirrors orbitEngine.js). Cosmetics are purely
 * visual and never touch CosmicScore or ranking.
 *
 * Render metadata (the CSS glow/gradient) lives on the FRONTEND
 * (cosmic/cosmetics.js) keyed by the same `key`; the server only owns the
 * economy (key, type, cost, ownership).
 */

// type: "name_glow" | "background". `rarity` keys match the frontend 15-tier
// ladder (cosmic/rarity.js); `category` groups items into the store tabs.
const CATALOG = Object.freeze([
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

const BY_KEY = new Map(CATALOG.map((c) => [c.key, c]));
const TYPES = Object.freeze(["name_glow", "background"]);
// Which equipped-slot each type maps to on user.orbit.cosmetics.
const SLOT = Object.freeze({ name_glow: "nameGlow", background: "background" });

const getItem = (key) => BY_KEY.get(key) || null;

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
    CATALOG, TYPES, SLOT,
    getItem, normalizeCosmetics, applyPurchase, applyEquip,
};
