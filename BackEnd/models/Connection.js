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
        enum: ["pending", "accepted", "declined"],
        default: "pending"
    }
}, { timestamps: true });

// Prevent duplicate pending requests between the same users for the same skill
connectionSchema.index({ requester: 1, receiver: 1, skill: 1 }, { unique: true });

module.exports = mongoose.model("Connection", connectionSchema);
