/**
 * storageService.js — Phase 7
 *
 * Captures per-collection size estimates using MongoDB's collStats command
 * and persists a StorageStats snapshot.
 *
 * Approach: use db.command({ collStats }) per collection to get storageSize
 * without requiring admin privileges that Atlas Free tier doesn't grant.
 *
 * Call captureStorageSnapshot() from the archive cron so every nightly run
 * also records a storage snapshot for trend visibility.
 */

const mongoose    = require('mongoose');
const StorageStats = require('../models/StorageStats');

// Byte multipliers
const MB = 1024 * 1024;

// Collections to track
const TRACKED = [
    { key: 'messages',      name: 'messages' },
    { key: 'chatArchives',  name: 'chatarchives' },
    { key: 'callHistories', name: 'callhistories' },
    { key: 'callArchives',  name: 'callarchives' },
    { key: 'connections',   name: 'connections' },
    { key: 'skills',        name: 'skills' },
    { key: 'users',         name: 'users' },
    { key: 'ratings',       name: 'ratings' },
];

/**
 * captureStorageSnapshot()
 *
 * Runs collStats on each tracked collection and persists a StorageStats doc.
 * Falls back gracefully if collStats is unavailable (e.g. unit tests).
 *
 * Returns the saved StorageStats document.
 */
async function captureStorageSnapshot() {
    const db = mongoose.connection.db;
    const collections = {};
    let totalBytes = 0;

    for (const { key, name } of TRACKED) {
        try {
            const stats = await db.command({ collStats: name });
            const bytes = stats.storageSize || stats.size || 0;
            const count = stats.count || 0;
            collections[key] = { count, estimatedBytes: bytes };
            totalBytes += bytes;
        } catch {
            // Collection may not exist yet (first run / test env)
            collections[key] = { count: 0, estimatedBytes: 0 };
        }
    }

    const totalMB      = +(totalBytes / MB).toFixed(2);
    const isNearLimit  = totalMB >= 460; // 90% of 512MB

    const snap = await StorageStats.create({
        capturedAt:         new Date(),
        collections,
        totalEstimatedMB:   totalMB,
        warningThresholdMB: 460,
        isNearLimit,
    });

    if (isNearLimit) {
        console.warn(`[StorageGuard] ⚠️  Database at ${totalMB} MB — approaching 512 MB Atlas Free limit!`);
    } else {
        console.log(`[StorageGuard] Storage snapshot: ${totalMB} MB used.`);
    }

    return snap;
}

/**
 * getLatestSnapshot()
 * Returns the most recent StorageStats document or null.
 */
async function getLatestSnapshot() {
    return StorageStats.findOne({}).sort({ capturedAt: -1 }).lean();
}

module.exports = { captureStorageSnapshot, getLatestSnapshot };
