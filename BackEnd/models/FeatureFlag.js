const mongoose = require("mongoose");

/**
 * FeatureFlag — runtime override for an Orbit config flag (Mission Control C1).
 * A row here OVERRIDES the env-derived default so admins can flip flags live
 * without a redeploy. Missing key → the env/default is used (services/flagStore.js),
 * so an empty collection means "current behavior".
 */
const featureFlagSchema = new mongoose.Schema({
    key:       { type: String, required: true, unique: true },   // e.g. "ORBIT_TIER2", "ORBIT_MSG_XP_CAP"
    value:     { type: mongoose.Schema.Types.Mixed, required: true },
    type:      { type: String, enum: ["bool", "int", "pct"], required: true },
    updatedBy: { type: String, default: "" },
}, { timestamps: true });

module.exports = mongoose.models.FeatureFlag || mongoose.model("FeatureFlag", featureFlagSchema);
