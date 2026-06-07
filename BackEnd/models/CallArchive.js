/**
 * CallArchive — Phase 3 Archival Model
 *
 * Stores call metadata (participants, duration, status, timestamps) for calls
 * older than the HOT_WINDOW_DAYS threshold. No raw media stored — metadata only.
 *
 * No TTL — call history must be permanently retrievable.
 */
const mongoose = require('mongoose');

const callArchiveSchema = new mongoose.Schema({
    // Original CallHistory _id — preserved so pagination cursors still work
    originalId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        unique: true,
    },
    caller: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    receiver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    roomName: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        enum: ['ringing', 'accepted', 'declined', 'missed', 'ended'],
        required: true,
    },
    startedAt: { type: Date, default: null },
    endedAt:   { type: Date, default: null },
    duration:  { type: Number, default: 0 }, // seconds
    // When the original hot doc was created (keep for history display)
    originalCreatedAt: { type: Date, required: true },
}, {
    timestamps: true,
});

// Fast lookup for user call history (mirrors the /history query shape)
callArchiveSchema.index({ caller:   1, originalCreatedAt: -1 });
callArchiveSchema.index({ receiver: 1, originalCreatedAt: -1 });

module.exports = mongoose.model('CallArchive', callArchiveSchema);
