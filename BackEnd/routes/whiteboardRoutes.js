const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const Whiteboard = require("../models/whiteboard");
const { verifyRoomMember } = require("../utils/roomMembership");

// GET /api/whiteboard/:roomName — load the saved board snapshot for a session.
// Membership-gated: only the two participants may read it.
router.get("/:roomName", auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { roomName } = req.params;

        const { ok } = await verifyRoomMember(userId, roomName);
        if (!ok) return res.status(403).json({ message: "Not a participant of this room" });

        const board = await Whiteboard.findOne({ roomName }).lean();
        res.json({ snapshot: board?.snapshot || null, updatedAt: board?.updatedAt || null });
    } catch (err) {
        console.error("Whiteboard load error:", err.message);
        res.status(500).json({ message: "Failed to load whiteboard" });
    }
});

// PUT /api/whiteboard/:roomName — persist the current board snapshot.
router.put("/:roomName", auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { roomName } = req.params;
        const { snapshot } = req.body;

        if (!snapshot || typeof snapshot !== "object") {
            return res.status(400).json({ message: "Invalid snapshot" });
        }
        // Size guard (defense-in-depth; express.json already caps at 10mb).
        if (Array.isArray(snapshot.objects) && snapshot.objects.length > 6000) {
            return res.status(413).json({ message: "Board too large" });
        }

        const { ok, participants } = await verifyRoomMember(userId, roomName);
        if (!ok) return res.status(403).json({ message: "Not a participant of this room" });

        await Whiteboard.findOneAndUpdate(
            { roomName },
            { roomName, snapshot, participants, lastEditedBy: userId },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        res.json({ message: "saved" });
    } catch (err) {
        console.error("Whiteboard save error:", err.message);
        res.status(500).json({ message: "Failed to save whiteboard" });
    }
});

module.exports = router;
