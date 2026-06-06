const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
    getConversation,
    sendMessage,
    getUnreadCount,
    getConversations
} = require('../controllers/messageController');

// Get all conversations (sidebar list)
router.get('/conversations', auth, getConversations);

// Get total unread count
router.get('/unread-count', auth, getUnreadCount);

// Get conversation with a specific user
router.get('/:userId', auth, getConversation);

// Send a message to a user
router.post('/:userId', auth, sendMessage);

module.exports = router;
