const mongoose = require("mongoose");

/**
 * RarityTier — the admin-managed 15-tier cosmic rarity ladder (spec C). Mirrors
 * the frontend source of truth (FrontEnd/src/cosmic/rarity.js) so tiers become
 * editable at runtime (label/color/glow/order) and assignable to store items and
 * Name FX. Seeded from rarity.js; an empty collection means the frontend ladder
 * is authoritative (nothing breaks).
 *
 * `key` is UPPER_SNAKE and STABLE (LUNAR…MULTIVERSAL). `glow` is the halo px that
 * scales with rank; `card`/`iridescent` are the top-tier treatments.
 */
const rarityTierSchema = new mongoose.Schema({
    key:        { type: String, required: true, unique: true },   // "LUNAR" … "MULTIVERSAL"
    label:      { type: String, required: true },                 // "Lunar"
    order:      { type: Number, required: true },                 // 1..15 (rank)
    color:      { type: String, required: true },                 // hex
    glow:       { type: Number, default: 8 },                     // halo px (scales with tier)
    card:       { type: Boolean, default: false },                // whole-card glow (top tiers)
    iridescent: { type: Boolean, default: false },                // animated hue (the ultimate tier)
    blurb:      { type: String, default: "" },
    live:       { type: Boolean, default: true },                 // shown/usable today
    updatedBy:  { type: String, default: "" },
}, { timestamps: true });

module.exports = mongoose.models.RarityTier || mongoose.model("RarityTier", rarityTierSchema);
