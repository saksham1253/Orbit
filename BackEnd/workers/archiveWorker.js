/**
 * archiveWorker.js — Phase 3 Nightly Archival Job
 *
 * Runs every night at 02:00 UTC using Node's built-in setInterval + cron-like
 * scheduling (no external cron dependency needed on Render free tier).
 *
 * What it does:
 *   1. Archives chat messages older than HOT_WINDOW_DAYS into ChatArchive (gzip)
 *   2. Archives call history older than HOT_WINDOW_DAYS into CallArchive
 *   3. Captures a StorageStats snapshot
 *   4. Logs results
 *
 * Safety:
 *   - Idempotent: re-running has no harmful side effects
 *   - Zero data loss: hot copies deleted ONLY after archive confirmed
 *   - No TTL on core history collections (only ephemeral StorageStats snapshots have TTL)
 *
 * To trigger manually (e.g. for testing):
 *   GET /api/admin/run-archive  (protected by ADMIN_SECRET header)
 */

const { archiveChatMessages, archiveCallHistory } = require('../services/archiveService');
const { captureStorageSnapshot }                  = require('../services/storageService');

// How many ms until 02:00 UTC today (or tomorrow if already past 02:00)
function msUntilNextRun(hour = 2, minute = 0) {
    const now  = new Date();
    const next = new Date();
    next.setUTCHours(hour, minute, 0, 0);
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1); // roll to tomorrow
    return next - now;
}

async function runArchiveJob() {
    console.log('[ArchiveWorker] Starting nightly archive job…');
    const start = Date.now();

    try {
        // 1. Chat messages
        const chatResult = await archiveChatMessages();
        console.log(`[ArchiveWorker] Chat: archived ${chatResult.archivedMessages} messages.`);
        if (chatResult.errors.length) {
            console.warn('[ArchiveWorker] Chat errors:', chatResult.errors);
        }

        // 2. Call history
        const callResult = await archiveCallHistory();
        console.log(`[ArchiveWorker] Calls: archived ${callResult.archivedCalls} records.`);
        if (callResult.errors.length) {
            console.warn('[ArchiveWorker] Call errors:', callResult.errors);
        }

        // 3. Storage snapshot
        const snap = await captureStorageSnapshot();
        console.log(`[ArchiveWorker] Storage: ${snap.totalEstimatedMB} MB used.`);

    } catch (err) {
        console.error('[ArchiveWorker] Fatal error:', err);
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    console.log(`[ArchiveWorker] Done in ${elapsed}s. Next run in ~24h.`);

    // Schedule next run in exactly 24 hours
    setTimeout(runArchiveJob, 24 * 60 * 60 * 1000);
}

/**
 * startArchiveWorker()
 * Call this once from server.js after DB connects.
 * Schedules the first run at 02:00 UTC, then every 24h after that.
 */
function startArchiveWorker() {
    const delay = msUntilNextRun(2, 0);
    const hours = (delay / 3600000).toFixed(1);
    console.log(`[ArchiveWorker] Scheduled. First run in ${hours}h (at 02:00 UTC).`);
    setTimeout(runArchiveJob, delay);
}

module.exports = { startArchiveWorker, runArchiveJob };
