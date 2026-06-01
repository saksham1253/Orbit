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

module.exports = mongoose.model("CallHistory", callHistorySchema);
