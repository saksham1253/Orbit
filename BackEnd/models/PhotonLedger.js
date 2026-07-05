const mongoose = require("mongoose");

/**
 * PhotonLedger — append-only record of every Photon flow (Mission Control C6).
 * `delta` is positive for a source (earn) and negative for a sink (spend). This
 * is what lets the Gravimeter reconcile the economy and detect inflation
 * (supply growing faster than it's spent). Additive; best-effort writes.
 */
const photonLedgerSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    delta:  { type: Number, required: true },              // + earn / − spend
    source: { type: String, required: true },              // "milestone" | "mission" | "mastery" | "freeze" | "cosmetic" | ...
}, { timestamps: { createdAt: true, updatedAt: false } });

photonLedgerSchema.index({ createdAt: -1 });
photonLedgerSchema.index({ userId: 1, createdAt: -1 });
photonLedgerSchema.index({ source: 1, createdAt: -1 });

module.exports = mongoose.models.PhotonLedger || mongoose.model("PhotonLedger", photonLedgerSchema);
