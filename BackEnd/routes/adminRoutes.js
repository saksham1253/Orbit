/**
 * adminRoutes.js — Phase 7 + Phase 3 manual trigger
 *
 * ALL routes protected by ADMIN_SECRET header to prevent public access.
 *
 * GET  /api/admin/storage-stats     → latest StorageStats snapshot
 * POST /api/admin/run-archive       → trigger archive job immediately (manual / test)
 * GET  /api/admin/archive-status    → counts in hot vs archive collections
 */

const express    = require('express');
const router     = express.Router();
const Message    = require('../models/Message');
const CallHistory = require('../models/callHistory');
const ChatArchive = require('../models/ChatArchive');
const CallArchive = require('../models/CallArchive');
const { getLatestSnapshot, captureStorageSnapshot } = require('../services/storageService');
const { runArchiveJob }                              = require('../workers/archiveWorker');

// ── Simple admin guard ────────────────────────────────────────
const adminGuard = (req, res, next) => {
    const secret = req.headers['x-admin-secret'];
    if (!secret || secret !== process.env.ADMIN_SECRET) {
        return res.status(403).json({ message: 'Forbidden' });
    }
    next();
};

// GET /api/admin/storage-stats
// Returns latest storage snapshot (or triggers a fresh one if none exists)
router.get('/storage-stats', adminGuard, async (req, res) => {
    try {
        let snap = await getLatestSnapshot();
        if (!snap) snap = await captureStorageSnapshot();
        res.json(snap);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST /api/admin/run-archive
// Immediately triggers the archive job (for testing / emergency pruning)
router.post('/run-archive', adminGuard, async (req, res) => {
    try {
        // Run without blocking the response
        runArchiveJob().catch(e => console.error('[AdminRoute] archive error:', e));
        res.json({ message: 'Archive job triggered. Check server logs for progress.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET /api/admin/archive-status
// Shows counts in hot vs archive collections for quick health check
router.get('/archive-status', adminGuard, async (req, res) => {
    try {
        const [hotMessages, hotCalls, archiveChats, archiveCalls] = await Promise.all([
            Message.countDocuments(),
            CallHistory.countDocuments(),
            ChatArchive.countDocuments(),
            CallArchive.countDocuments(),
        ]);

        const archiveMsgCount = await ChatArchive.aggregate([
            { $group: { _id: null, total: { $sum: '$messageCount' } } }
        ]);

        res.json({
            hot: {
                messages: hotMessages,
                callHistories: hotCalls,
            },
            archived: {
                chatArchiveBuckets: archiveChats,
                archivedMessages:   archiveMsgCount[0]?.total || 0,
                callArchives:       archiveCalls,
            },
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
