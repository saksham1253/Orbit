const express = require("express");
const router = express.Router();

const {
    listNotifications,
    unreadCount,
    markRead,
    markAllRead,
} = require("../controllers/notificationController");

const auth = require("../middleware/auth");

// All notification routes are user-scoped (protected).
router.get("/", auth, listNotifications);
router.get("/unread-count", auth, unreadCount);
router.patch("/read-all", auth, markAllRead);
router.patch("/:id/read", auth, markRead);

module.exports = router;
