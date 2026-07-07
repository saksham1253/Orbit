const mongoose = require("mongoose");

/**
 * StoreItem — an admin-managed Nebula Store catalog entry (spec B). Replaces the
 * hard-coded services/cosmeticsCatalog.js CATALOG at runtime: when this collection
 * is non-empty it becomes the source of truth (loaded into the catalog cache);
 * when empty, the JS defaults are used, so an un-seeded install behaves exactly as
 * before. The pure buy/equip reducers are unchanged — only the item source moves.
 *
 * Lifecycle: draft → live → archived (soft state). `status:'live'` items show in
 * the user shop and are purchasable; owned items still resolve for equip even if
 * later archived. Render metadata (CSS glow/gradient) stays on the FRONTEND
 * (cosmic/cosmetics.js) keyed by the same `key` — the server owns the economy.
 */
const storeItemSchema = new mongoose.Schema({
    key:         { type: String, required: true, unique: true },  // e.g. "glow_void"
    type:        { type: String, required: true },                // "name_glow" | "background" | (future types)
    name:        { type: String, required: true },
    hint:        { type: String, default: "" },
    cost:        { type: Number, required: true, min: 0 },         // Photons
    rarity:      { type: String, default: "STELLAR" },             // RarityTier.key
    category:    { type: String, default: "identity" },           // store tab grouping
    status:      { type: String, enum: ["draft", "live", "archived"], default: "draft" },
    stock:       { type: Number, default: null },                 // null = unlimited
    discountPct: { type: Number, default: 0, min: 0, max: 100 },
    availableFrom: { type: Date, default: null },
    availableTo:   { type: Date, default: null },
    sortOrder:   { type: Number, default: 0 },
    updatedBy:   { type: String, default: "" },
}, { timestamps: true });

storeItemSchema.index({ status: 1, category: 1, sortOrder: 1 });

module.exports = mongoose.models.StoreItem || mongoose.model("StoreItem", storeItemSchema);
