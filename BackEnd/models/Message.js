const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    receiver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        required: true,
        trim: true,
        maxlength: 2000
    },
    read: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Existing indexes (kept as-is)
messageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });
messageSchema.index({ receiver: 1, read: 1 }); // for unread counts

// Phase 6 — new compound indexes matching real query shapes
// getConversations aggregate: match on sender OR receiver, sort createdAt -1
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ receiver: 1, createdAt: -1 });
// archiveWorker cutoff scan: find hot messages older than threshold
messageSchema.index({ createdAt: 1 }); // ascending for range pruning

// Phase 3 — deterministic conversation key helper (used by archive worker)
// Returns the smaller ObjectId string first so the key is symmetric
messageSchema.statics.conversationKey = function(idA, idB) {
    const a = idA.toString();
    const b = idB.toString();
    return a < b ? `${a}_${b}` : `${b}_${a}`;
};

module.exports = mongoose.model('Message', messageSchema);
