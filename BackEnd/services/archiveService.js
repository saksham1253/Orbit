/**
 * archiveService.js — Phase 3 + Phase 4
 *
 * Provides:
 *   archiveChatMessages(daysOld)   — move aged Message docs into ChatArchive (gzip-compressed)
 *   archiveCallHistory(daysOld)    — move aged CallHistory docs into CallArchive
 *
 * Design guarantees:
 *   • Idempotent: safe to run multiple times (upsert + duplicate key handling)
 *   • Zero data loss: hot copy removed ONLY after archive write is confirmed
 *   • No TTL on ChatArchive or CallArchive — data is permanent
 *   • Batch-process in pages of BATCH_SIZE to avoid memory spikes
 *   • Returns { archivedMessages, archivedCalls, errors[] } for the worker log
 */

const zlib = require('zlib');
const { promisify } = require('util');
const mongoose = require('mongoose');

const Message     = require('../models/Message');
const ChatArchive = require('../models/ChatArchive');
const CallHistory = require('../models/callHistory');
const CallArchive = require('../models/CallArchive');

const gzip   = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

// ─────────────────────────────────────────────────────────────
// Configuration constants (tweak without code changes)
// ─────────────────────────────────────────────────────────────
const HOT_WINDOW_DAYS = parseInt(process.env.ARCHIVE_HOT_DAYS  || '90', 10);
const BATCH_SIZE      = parseInt(process.env.ARCHIVE_BATCH_SIZE || '500', 10);

// ─────────────────────────────────────────────────────────────
// Compression helpers — Phase 4
// ─────────────────────────────────────────────────────────────

/**
 * Compress a JS value → base64 gzip string.
 * Stored in ChatArchive.compressedMessages.
 */
async function compress(obj) {
    const json   = JSON.stringify(obj);
    const buf    = await gzip(Buffer.from(json, 'utf8'));
    return {
        compressed : buf.toString('base64'),
        rawByteSize: Buffer.byteLength(json, 'utf8'),
    };
}

/**
 * Decompress a base64 gzip string → JS value.
 * Called by the "load older" API path.
 */
async function decompress(b64) {
    const buf  = Buffer.from(b64, 'base64');
    const raw  = await gunzip(buf);
    return JSON.parse(raw.toString('utf8'));
}

// ─────────────────────────────────────────────────────────────
// Phase 3 — Chat Archival
// ─────────────────────────────────────────────────────────────

/**
 * Build the yearMonth bucket string for a given Date.
 * e.g. new Date('2025-03-15') → "2025-03"
 */
function toYearMonth(date) {
    const d = new Date(date);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * archiveChatMessages(daysOld = HOT_WINDOW_DAYS)
 *
 * Finds all messages older than `daysOld`, groups them by
 * (conversationKey × yearMonth), compresses each group, upserts
 * a ChatArchive doc, then bulk-deletes the hot copies.
 *
 * Returns { archivedMessages: N, errors: [] }
 */
async function archiveChatMessages(daysOld = HOT_WINDOW_DAYS) {
    const cutoff = new Date(Date.now() - daysOld * 24 * 3600 * 1000);
    let totalArchived = 0;
    const errors = [];

    let lastId = null; // cursor-based batching to avoid skip() cost

    // eslint-disable-next-line no-constant-condition
    while (true) {
        const query = { createdAt: { $lt: cutoff } };
        if (lastId) query._id = { $gt: lastId };

        const batch = await Message.find(query)
            .sort({ _id: 1 })
            .limit(BATCH_SIZE)
            .lean();

        if (!batch.length) break;
        lastId = batch[batch.length - 1]._id;

        // ── Group by conversationKey × yearMonth ──
        const groups = new Map(); // key: "convKey|yearMonth"
        for (const msg of batch) {
            const convKey  = Message.conversationKey(msg.sender, msg.receiver);
            const ym       = toYearMonth(msg.createdAt);
            const groupKey = `${convKey}|${ym}`;

            if (!groups.has(groupKey)) {
                groups.set(groupKey, {
                    conversationKey: convKey,
                    yearMonth: ym,
                    participants: new Set([msg.sender.toString(), msg.receiver.toString()]),
                    messages: [],
                    ids: [],
                });
            }
            const g = groups.get(groupKey);
            g.messages.push(msg);
            g.ids.push(msg._id);
        }

        // ── Compress + upsert each group ──
        const idsToDelete = [];

        for (const group of groups.values()) {
            try {
                const { compressed, rawByteSize } = await compress(group.messages);
                const participantsArr = [...group.participants].map(
                    id => new mongoose.Types.ObjectId(id)
                );

                // Upsert: if an archive doc already exists for this month, append to it
                const existing = await ChatArchive.findOne({
                    conversationKey: group.conversationKey,
                    yearMonth: group.yearMonth,
                });

                if (existing) {
                    // Decompress existing, merge, re-compress
                    const existingMsgs = await decompress(existing.compressedMessages);
                    const merged = existingMsgs.concat(group.messages);
                    // Sort merged by createdAt ascending for tidy storage
                    merged.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                    const recompressed = await compress(merged);

                    await ChatArchive.updateOne(
                        { _id: existing._id },
                        {
                            $set: {
                                compressedMessages: recompressed.compressed,
                                messageCount: merged.length,
                                rawByteSize: recompressed.rawByteSize,
                            }
                        }
                    );
                } else {
                    await ChatArchive.create({
                        conversationKey: group.conversationKey,
                        participants: participantsArr,
                        yearMonth: group.yearMonth,
                        compressedMessages: compressed,
                        messageCount: group.messages.length,
                        rawByteSize,
                    });
                }

                // Only mark for deletion after successful archive write
                idsToDelete.push(...group.ids);
                totalArchived += group.ids.length;

            } catch (err) {
                // DuplicateKey on race: just log, don't delete hot copies
                if (err.code !== 11000) {
                    errors.push({ group: group.conversationKey, err: err.message });
                }
            }
        }

        // ── Bulk delete confirmed hot copies ──
        if (idsToDelete.length) {
            await Message.deleteMany({ _id: { $in: idsToDelete } });
        }
    }

    return { archivedMessages: totalArchived, errors };
}

// ─────────────────────────────────────────────────────────────
// Phase 3 — Call History Archival
// ─────────────────────────────────────────────────────────────

/**
 * archiveCallHistory(daysOld = HOT_WINDOW_DAYS)
 *
 * Copies CallHistory docs older than `daysOld` into CallArchive,
 * then deletes the hot originals.
 *
 * Returns { archivedCalls: N, errors: [] }
 */
async function archiveCallHistory(daysOld = HOT_WINDOW_DAYS) {
    const cutoff = new Date(Date.now() - daysOld * 24 * 3600 * 1000);
    let totalArchived = 0;
    const errors = [];

    let lastId = null;

    // eslint-disable-next-line no-constant-condition
    while (true) {
        const query = { createdAt: { $lt: cutoff } };
        if (lastId) query._id = { $gt: lastId };

        const batch = await CallHistory.find(query)
            .sort({ _id: 1 })
            .limit(BATCH_SIZE)
            .lean();

        if (!batch.length) break;
        lastId = batch[batch.length - 1]._id;

        const archiveDocs = batch.map(call => ({
            originalId: call._id,
            caller: call.caller,
            receiver: call.receiver,
            roomName: call.roomName,
            status: call.status,
            startedAt: call.startedAt,
            endedAt: call.endedAt,
            duration: call.duration,
            originalCreatedAt: call.createdAt,
        }));

        const confirmedIds = [];

        for (const doc of archiveDocs) {
            try {
                await CallArchive.create(doc);
                confirmedIds.push(doc.originalId);
                totalArchived++;
            } catch (err) {
                // Duplicate key = already archived; safe to delete hot copy
                if (err.code === 11000) {
                    confirmedIds.push(doc.originalId);
                    totalArchived++;
                } else {
                    errors.push({ callId: doc.originalId, err: err.message });
                }
            }
        }

        if (confirmedIds.length) {
            await CallHistory.deleteMany({ _id: { $in: confirmedIds } });
        }
    }

    return { archivedCalls: totalArchived, errors };
}

// ─────────────────────────────────────────────────────────────
// Public decompress helper (used by message controller)
// ─────────────────────────────────────────────────────────────
module.exports = {
    archiveChatMessages,
    archiveCallHistory,
    decompress,
    compress,
    HOT_WINDOW_DAYS,
};
