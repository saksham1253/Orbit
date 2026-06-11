const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
    getConversation,
    sendMessage,
    getUnreadCount,
    getConversations,
    getArchivedMessages,
    getArchiveMonths,
    deleteMessage,
    clearConversation,
} = require('../controllers/messageController');

// ── Existing routes (unchanged) ───────────────────────────────
// Get all conversations (sidebar list)
router.get('/conversations', auth, getConversations);

// Get total unread count
router.get('/unread-count', auth, getUnreadCount);

// ── New deletion routes (additive, auth + ownership enforced) ──
// Delete a single message: ?scope=me (default) | everyone (sender only)
router.delete('/message/:messageId', auth, deleteMessage);

// Clear an entire conversation with a user (hide-for-me + reclaim)
router.delete('/conversation/:userId', auth, clearConversation);

// Get conversation with a specific user (now supports ?cursor + ?limit)
router.get('/:userId', auth, getConversation);

// Send a message to a user
router.post('/:userId', auth, sendMessage);

// ── New Phase 5 archive-read routes (additive) ────────────────
// List available archive month buckets for a conversation
router.get('/:userId/archive-months', auth, getArchiveMonths);

// Load a specific month of archived messages (decompressed on read)
router.get('/:userId/archive', auth, getArchivedMessages);

module.exports = router;
