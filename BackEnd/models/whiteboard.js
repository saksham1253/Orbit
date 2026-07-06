const mongoose = require("mongoose");

/**
 * Persisted whiteboard for a session (1:1 call room).
 *
 * Keyed by the same deterministic `roomName` used for the video call, so the
 * board a pair drew on is retrievable across reconnects and re-openable from
 * call history. `snapshot` holds the serialized Board state (pages + objects);
 * `participants` gates who may read/write it (checked against the JWT user).
 */
const whiteboardSchema = new mongoose.Schema({
    roomName: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    participants: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: "User",
        default: []
    },
    // Board.snapshot() → { v, pages, objects, clock }. Mixed since object shapes
    // vary (strokes/shapes/text/sticky/image/math/code).
    snapshot: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    lastEditedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    }
}, {
    timestamps: true
});

module.exports = mongoose.model("Whiteboard", whiteboardSchema);
