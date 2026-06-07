/**
 * StorageStats — Phase 7 Observability Model
 *
 * A single document (upserted by cron) recording estimated collection sizes
 * so growth trends are visible without running expensive admin commands each request.
 *
 * TTL: 90 days on each snapshot so old entries auto-purge; the LATEST snapshot
 * is always queryable via { sort: { capturedAt: -1 }, limit: 1 }.
 */
const mongoose = require('mongoose');

const storageStatsSchema = new mongoose.Schema({
    capturedAt: { type: Date, default: Date.now },
    // Size estimates in bytes per collection
    collections: {
        messages:        { count: Number, estimatedBytes: Number },
        chatArchives:    { count: Number, estimatedBytes: Number },
        callHistories:   { count: Number, estimatedBytes: Number },
        callArchives:    { count: Number, estimatedBytes: Number },
        connections:     { count: Number, estimatedBytes: Number },
        skills:          { count: Number, estimatedBytes: Number },
        users:           { count: Number, estimatedBytes: Number },
        ratings:         { count: Number, estimatedBytes: Number },
    },
    totalEstimatedMB:   { type: Number },
    warningThresholdMB: { type: Number, default: 460 },   // warn at 90% of 512
    isNearLimit:        { type: Boolean, default: false },
}, {
    timestamps: false,
});

// TTL: auto-purge snapshots older than 90 days (low-value historical data)
storageStatsSchema.index({ capturedAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });

module.exports = mongoose.model('StorageStats', storageStatsSchema);
