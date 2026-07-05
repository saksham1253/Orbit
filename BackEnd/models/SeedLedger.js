const mongoose = require("mongoose");

/**
 * SeedLedger — records exactly which docs a demo-seed run created (and whether
 * it snapshotted the target user's prior orbit), so teardown can undo a run
 * PRECISELY without tagging every model or risking orphaned/real data.
 *
 * `refs` are {model, id} of docs the run CREATED (partner-bot, rivals,
 * constellation, connection, skills). `targetUserId` + `prevOrbit` let teardown
 * restore the real account's orbit to exactly what it was before seeding.
 */
const seedLedgerSchema = new mongoose.Schema({
    seedRunId:    { type: String, required: true, index: true },
    tag:          { type: String, default: "orbit-demo" },
    targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    prevOrbit:    { type: mongoose.Schema.Types.Mixed, default: null }, // restore-on-teardown
    prevSkillIds: { type: [mongoose.Schema.Types.ObjectId], default: [] }, // pre-existing skills (not deleted)
    refs: {
        type: [{
            model: String,
            id:    mongoose.Schema.Types.ObjectId,
            _id: false,
        }],
        default: [],
    },
    summary: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

seedLedgerSchema.index({ targetUserId: 1, createdAt: -1 });

module.exports = mongoose.models.SeedLedger || mongoose.model("SeedLedger", seedLedgerSchema);
