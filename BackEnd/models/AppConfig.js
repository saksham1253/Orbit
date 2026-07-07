const mongoose = require("mongoose");

/**
 * AppConfig — runtime override for a namespaced gameplay/economy config VALUE.
 * Sibling to FeatureFlag, but for arbitrary JSON groups rather than typed flags.
 *
 * A row here OVERRIDES the hard-coded JS default for one `namespace`.`key` pair
 * (e.g. namespace "economy", key "FREEZE_STARDUST_COST"), so admins can tune
 * payouts / prices / thresholds live without a redeploy. Missing key → the JS
 * default is used (services/configStore.js resolveConfig), so an empty
 * collection means "current behavior" and nothing can crash on a missing row.
 *
 * `value` is Mixed so a key can hold a number, string, bool, array, or object
 * (e.g. the MILESTONES map). Reversible: clearing the row restores the default.
 */
const appConfigSchema = new mongoose.Schema({
    namespace: { type: String, required: true },  // "economy" | "streaks" | "ranking" | "store" | ...
    key:       { type: String, required: true },  // e.g. "FREEZE_STARDUST_COST", "MILESTONES"
    value:     { type: mongoose.Schema.Types.Mixed, required: true },
    updatedBy: { type: String, default: "" },
}, { timestamps: true });

// One override per namespace+key.
appConfigSchema.index({ namespace: 1, key: 1 }, { unique: true });

module.exports = mongoose.models.AppConfig || mongoose.model("AppConfig", appConfigSchema);
