const mongoose = require("mongoose");

const callHistorySchema = new mongoose.Schema({
    caller: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    receiver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    roomName: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ["ringing", "accepted", "declined", "missed", "ended"],
        default: "ringing"
    },
    startedAt: {
        type: Date,
        default: null
    },
    endedAt: {
        type: Date,
        default: null
    },
    duration: {
        type: Number, // seconds
        default: 0
    }
}, {
    timestamps: true
});

// Phase 6 — compound indexes matching /api/video/history query shape
// { $or: [{ caller: userId }, { receiver: userId }] } + sort createdAt -1
callHistorySchema.index({ caller:   1, createdAt: -1 });
callHistorySchema.index({ receiver: 1, createdAt: -1 });
// ascending createdAt for archive worker range scans
callHistorySchema.index({ createdAt: 1 });
// status + createdAt for the "mark old ringing as missed" pattern
callHistorySchema.index({ status: 1, createdAt: 1 });

module.exports = mongoose.model("CallHistory", callHistorySchema);
