const mongoose = require("mongoose");

const connectionSchema = new mongoose.Schema({
    requester: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    receiver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    skill: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Skill",
        required: true
    },
    message: {
        type: String,
        default: ""
    },
    status: {
        type: String,
        enum: ["pending", "accepted", "declined", "completed"],
        default: "pending"
    },
    completedAt: {
        type: Date
    }
}, { timestamps: true });

// Prevent duplicate pending requests between the same users for the same skill
connectionSchema.index({ requester: 1, receiver: 1, skill: 1 }, { unique: true });

// Performance optimization — compound indexes for common query patterns
// GET /api/connections: find({ $or: [{ requester: userId }, { receiver: userId }] })
connectionSchema.index({ requester: 1, status: 1, createdAt: -1 });
connectionSchema.index({ receiver: 1, status: 1, createdAt: -1 });

// Status-based filtering (e.g., pending requests count)
connectionSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("Connection", connectionSchema);
