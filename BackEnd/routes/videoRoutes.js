const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const crypto = require("crypto");
const User = require("../models/user");
const CallHistory = require("../models/callHistory");

// Generate a deterministic room name for two users
function generateRoomName(userId1, userId2) {
    const sorted = [userId1, userId2].sort();
    const hash = crypto.createHash("sha256").update(sorted.join("-")).digest("hex").slice(0, 12);
    return `SkillSwap-${hash}`;
}

// POST /api/video/create-room — Create a video call room and notify receiver
router.post("/create-room", auth, async (req, res) => {
    try {
        const { targetUserId } = req.body;
        const currentUserId = req.user.id;

        if (!targetUserId) {
            return res.status(400).json({ message: "Target user ID is required" });
        }

        if (targetUserId === currentUserId) {
            return res.status(400).json({ message: "Cannot create a video call with yourself" });
        }

        // Verify target user exists
        const targetUser = await User.findById(targetUserId).select("name email");
        if (!targetUser) {
            return res.status(404).json({ message: "User not found" });
        }

        const currentUser = await User.findById(currentUserId).select("name");
        const roomName = generateRoomName(currentUserId, targetUserId);

        // Create call history record
        const callRecord = await CallHistory.create({
            caller: currentUserId,
            receiver: targetUserId,
            roomName,
            status: "ringing"
        });

        // Emit socket event to the receiver
        const io = req.app.get("io");
        if (io) {
            const room = io.sockets.adapter.rooms.get(`user_${targetUserId}`);
            if (!room || room.size === 0) {
                // Remove the call record if they are offline so it doesn't stay "ringing"
                await CallHistory.findByIdAndDelete(callRecord._id);
                return res.status(400).json({ message: "User is not available online right now" });
            }

            io.to(`user_${targetUserId}`).emit("incoming-call", {
                callId: callRecord._id,
                roomName,
                caller: {
                    id: currentUserId,
                    name: currentUser?.name || "Orbit User"
                },
                jitsiDomain: "jitsi.riot.im"
            });
        }

        res.json({
            callId: callRecord._id,
            roomName,
            jitsiDomain: "jitsi.riot.im",
            targetUser: {
                id: targetUser._id,
                name: targetUser.name
            },
            currentUser: {
                id: currentUserId,
                name: currentUser?.name || "Orbit User"
            }
        });
    } catch (err) {
        console.error("Video room error:", err.message);
        res.status(500).json({ message: "Failed to create video room" });
    }
});

// POST /api/video/respond — Accept or decline a call
router.post("/respond", auth, async (req, res) => {
    try {
        const { callId, action } = req.body; // action: "accepted" or "declined"
        const userId = req.user.id;

        if (!callId || !["accepted", "declined"].includes(action)) {
            return res.status(400).json({ message: "Invalid call ID or action" });
        }

        const call = await CallHistory.findById(callId);
        if (!call) return res.status(404).json({ message: "Call not found" });

        if (call.receiver.toString() !== userId) {
            return res.status(403).json({ message: "Not authorized to respond to this call" });
        }

        call.status = action;
        if (action === "accepted") {
            call.startedAt = new Date();
        }
        await call.save();

        // Notify the caller about the response
        const io = req.app.get("io");
        const receiver = await User.findById(userId).select("name");

        if (io) {
            io.to(`user_${call.caller.toString()}`).emit("call-response", {
                callId: call._id,
                action,
                roomName: call.roomName,
                receiver: {
                    id: userId,
                    name: receiver?.name || "User"
                }
            });
        }

        res.json({ message: `Call ${action}`, call });
    } catch (err) {
        console.error("Call respond error:", err.message);
        res.status(500).json({ message: "Failed to respond to call" });
    }
});

// POST /api/video/end — End an active call
router.post("/end", auth, async (req, res) => {
    try {
        const { callId } = req.body;

        const call = await CallHistory.findById(callId);
        if (!call) return res.status(404).json({ message: "Call not found" });

        call.status = "ended";
        call.endedAt = new Date();
        if (call.startedAt) {
            call.duration = Math.round((call.endedAt - call.startedAt) / 1000);
        }
        await call.save();

        // Notify the other party
        const io = req.app.get("io");
        const userId = req.user.id;
        const otherUserId = call.caller.toString() === userId
            ? call.receiver.toString()
            : call.caller.toString();

        if (io) {
            io.to(`user_${otherUserId}`).emit("call-ended", {
                callId: call._id
            });
        }

        res.json({ message: "Call ended", call });
    } catch (err) {
        console.error("Call end error:", err.message);
        res.status(500).json({ message: "Failed to end call" });
    }
});

// GET /api/video/history — Get call history for current user
router.get("/history", auth, async (req, res) => {
    try {
        const userId = req.user.id;

        const calls = await CallHistory.find({
            $or: [{ caller: userId }, { receiver: userId }],
            hiddenFor: { $ne: userId }   // exclude entries this user deleted
        })
            .sort({ createdAt: -1 })
            .limit(50)
            .populate("caller", "name email avatar")
            .populate("receiver", "name email avatar");

        // Mark any old "ringing" calls as "missed" (older than 60s)
        const now = new Date();
        for (const call of calls) {
            if (call.status === "ringing" && (now - call.createdAt) > 60000) {
                call.status = "missed";
                await call.save();
            }
        }

        res.json({ calls });
    } catch (err) {
        console.error("Call history error:", err.message);
        res.status(500).json({ message: "Failed to load call history" });
    }
});

// DELETE /api/video/history — clear ALL call history for the current user.
// Hides every entry for the requester; hard-deletes those both parties hid.
// NOTE: declared before "/history/:callId" so the literal path wins.
router.delete("/history", auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const mine = { $or: [{ caller: userId }, { receiver: userId }] };

        await CallHistory.updateMany(mine, { $addToSet: { hiddenFor: userId } });
        // Reclaim: drop entries where BOTH participants are now in hiddenFor
        await CallHistory.deleteMany({
            ...mine,
            $expr: { $setIsSubset: [["$caller", "$receiver"], "$hiddenFor"] }
        });

        res.json({ message: "Call history cleared" });
    } catch (err) {
        console.error("Clear call history error:", err.message);
        res.status(500).json({ message: "Failed to clear call history" });
    }
});

// DELETE /api/video/history/:callId — delete one entry for the current user.
router.delete("/history/:callId", auth, async (req, res) => {
    try {
        const userId = req.user.id;
        const call = await CallHistory.findById(req.params.callId);
        if (!call) return res.status(404).json({ message: "Call not found" });

        const isParticipant = call.caller.toString() === userId || call.receiver.toString() === userId;
        if (!isParticipant) return res.status(403).json({ message: "Not authorized" });

        await CallHistory.updateOne({ _id: call._id }, { $addToSet: { hiddenFor: userId } });

        // Reclaim storage once both participants have hidden it
        const updated = await CallHistory.findById(call._id).select("hiddenFor caller receiver").lean();
        const hidden = new Set((updated.hiddenFor || []).map(String));
        if (hidden.has(updated.caller.toString()) && hidden.has(updated.receiver.toString())) {
            await CallHistory.deleteOne({ _id: call._id });
        }

        res.json({ message: "Call deleted", callId: call._id });
    } catch (err) {
        console.error("Delete call error:", err.message);
        res.status(500).json({ message: "Failed to delete call" });
    }
});

module.exports = router;
