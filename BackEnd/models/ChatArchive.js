/**
 * ChatArchive — Phase 3 Archival Model
 *
 * One document per (conversationKey × month).
 * conversationKey = sorted [userId1, userId2].join('_') — deterministic.
 *
 * 'messages' field holds a gzip-compressed, base64-encoded JSON array of the
 * original message objects (Phase 4 compression). The schema stores a count
 * separately so aggregate stats work without decompressing.
 *
 * Lifecycle:
 *   archiveWorker runs nightly → migrates messages older than HOT_WINDOW_DAYS
 *   from Message collection into here → deletes hot copies ONLY after write confirmed.
 *
 * Rule 6 (Absolute): NO TTL on this collection — archive docs are permanent.
 */
const mongoose = require('mongoose');

const chatArchiveSchema = new mongoose.Schema({
    // Deterministic conversation key: smaller ObjectId string first
    conversationKey: {
        type: String,
        required: true,
    },
    // The two participants (for auth-checks and reverse lookups)
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
    // Year-month bucket: "2025-03"
    yearMonth: {
        type: String,
        required: true,
    },
    // gzip → base64 encoded JSON array of plain message objects
    // Shape of each element mirrors the Message model output:
    // { _id, sender, receiver, content, read, createdAt, updatedAt }
    compressedMessages: {
        type: String,
        required: true,
    },
    // Pre-computed count so stats queries don't decompress
    messageCount: {
        type: Number,
        default: 0,
    },
    // Size in bytes of the raw JSON before compression (for storage monitoring)
    rawByteSize: {
        type: Number,
        default: 0,
    },
}, {
    timestamps: true,
});

// Unique: one archive doc per conversation per month
chatArchiveSchema.index({ conversationKey: 1, yearMonth: 1 }, { unique: true });
// Fast lookup by participant
chatArchiveSchema.index({ participants: 1, yearMonth: -1 });

module.exports = mongoose.model('ChatArchive', chatArchiveSchema);
