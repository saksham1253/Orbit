const Notification = require("../models/Notification");

// ================= LIST (paginated, newest first) =================
exports.listNotifications = async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit, 10) || 30, 100);
        const before = req.query.before ? new Date(req.query.before) : null;

        const filter = { userId: req.user.id };
        if (before && !isNaN(before.getTime())) filter.createdAt = { $lt: before };

        const items = await Notification.find(filter)
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

        res.status(200).json({ items });
    } catch (err) {
        console.error("listNotifications:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// ================= UNREAD COUNT =================
exports.unreadCount = async (req, res) => {
    try {
        const count = await Notification.countDocuments({ userId: req.user.id, read: false });
        res.status(200).json({ count });
    } catch (err) {
        console.error("unreadCount:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// ================= MARK ONE READ =================
exports.markRead = async (req, res) => {
    try {
        const n = await Notification.findOneAndUpdate(
            { _id: req.params.id, userId: req.user.id },
            { $set: { read: true } },
            { new: true }
        ).lean();
        if (!n) return res.status(404).json({ message: "Notification not found" });
        res.status(200).json({ notification: n });
    } catch (err) {
        console.error("markRead:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// ================= MARK ALL READ =================
exports.markAllRead = async (req, res) => {
    try {
        await Notification.updateMany(
            { userId: req.user.id, read: false },
            { $set: { read: true } }
        );
        res.status(200).json({ message: "All marked read" });
    } catch (err) {
        console.error("markAllRead:", err);
        res.status(500).json({ message: "Server error" });
    }
};
