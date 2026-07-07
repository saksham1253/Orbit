/**
 * seedStore.js — seed the admin-managed Nebula Store into the DB so the Command
 * Center reflects live production data (spec deliverable).
 *
 *   node scripts/seedStore.js       (or: npm run seed:store)
 *
 * Idempotent: upserts the 15 rarity tiers (mirroring FrontEnd/src/cosmic/rarity.js)
 * and the 9 default cosmetics (from cosmeticsCatalog.DEFAULT_CATALOG) as LIVE
 * StoreItems. Safe to re-run — existing rows are updated, admin-added rows are
 * left untouched. Once seeded, the StoreItem collection is the catalog source of
 * truth (cosmeticsCatalog overlays it); before seeding, the JS defaults are used.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const RarityTier = require("../models/RarityTier");
const StoreItem = require("../models/StoreItem");
const { DEFAULT_CATALOG } = require("../services/cosmeticsCatalog");

// The 15-tier ladder — kept in sync with FrontEnd/src/cosmic/rarity.js.
const TIERS = [
    { key: "LUNAR",         label: "Lunar",         order: 1,  color: "#cbd5e1", glow: 7,  card: false, live: true,  blurb: "Moonlight — humble, the most common." },
    { key: "STELLAR",       label: "Stellar",       order: 2,  color: "#7dd3fc", glow: 11, card: false, live: true,  blurb: "A single star." },
    { key: "SOLAR",         label: "Solar",         order: 3,  color: "#fbbf24", glow: 13, card: false, live: false, blurb: "A full star and its system." },
    { key: "NEBULAR",       label: "Nebular",       order: 4,  color: "#2dd4bf", glow: 14, card: false, live: false, blurb: "A nebula — a star nursery." },
    { key: "ASTRAL",        label: "Astral",        order: 5,  color: "#38bdf8", glow: 15, card: false, live: false, blurb: "Ethereal star-field energy." },
    { key: "CELESTIAL",     label: "Celestial",     order: 6,  color: "#818cf8", glow: 16, card: false, live: false, blurb: "The heavens as a whole." },
    { key: "GALACTIC",      label: "Galactic",      order: 7,  color: "#6366f1", glow: 17, card: false, live: false, blurb: "An entire galaxy." },
    { key: "COSMIC",        label: "Cosmic",        order: 8,  color: "#a855f7", glow: 18, card: false, live: true,  blurb: "The whole observable cosmos." },
    { key: "HYPERNOVA",     label: "Hypernova",     order: 9,  color: "#fb923c", glow: 21, card: true,  live: true,  blurb: "The most energetic stellar explosion." },
    { key: "BLACK_HOLE",    label: "Black Hole",    order: 10, color: "#0b0d17", glow: 22, card: true,  live: false, blurb: "Collapsed mass — light can't escape." },
    { key: "EVENT_HORIZON", label: "Event Horizon", order: 11, color: "#7c3aed", glow: 24, card: true,  live: false, blurb: "The point of no return." },
    { key: "SINGULARITY",   label: "Singularity",   order: 12, color: "#ec4899", glow: 30, card: true,  live: true,  blurb: "The infinite-density core — most extreme." },
    { key: "DARK_MATTER",   label: "Dark Matter",   order: 13, color: "#4c1d95", glow: 33, card: true,  live: false, blurb: "The invisible ~27% of the universe." },
    { key: "ANTIMATTER",    label: "Antimatter",    order: 14, color: "#ef4444", glow: 36, card: true,  live: false, blurb: "Mirror of matter — annihilation-grade." },
    { key: "MULTIVERSAL",   label: "Multiversal",   order: 15, color: "#a855f7", glow: 40, card: true,  iridescent: true, live: false, blurb: "Beyond a single universe — the ultimate tier." },
];

/** Idempotent seed. Returns counts. Reusable from a boot hook if ever needed. */
async function seedStore() {
    let tiers = 0, items = 0;
    for (const t of TIERS) {
        await RarityTier.updateOne({ key: t.key }, { $set: { ...t, updatedBy: "seed" } }, { upsert: true });
        tiers++;
    }
    let order = 0;
    for (const c of DEFAULT_CATALOG) {
        await StoreItem.updateOne(
            { key: c.key },
            { $set: { key: c.key, type: c.type, name: c.name, hint: c.hint, cost: c.cost, rarity: c.rarity, category: c.category, status: "live", sortOrder: order++, updatedBy: "seed" } },
            { upsert: true }
        );
        items++;
    }
    return { tiers, items };
}

module.exports = { seedStore, TIERS };

// CLI entry
if (require.main === module) {
    (async () => {
        if (!process.env.MONGO_URI) { console.error("[seed:store] MONGO_URI is not set."); process.exit(1); }
        await mongoose.connect(process.env.MONGO_URI);
        const { tiers, items } = await seedStore();
        console.log(`[seed:store] ✓ ${tiers} rarity tiers, ${items} store items upserted.`);
        await mongoose.connection.close();
        process.exit(0);
    })().catch(async (err) => {
        console.error("[seed:store] failed:", err.message);
        try { await mongoose.connection.close(); } catch { /* noop */ }
        process.exit(1);
    });
}
