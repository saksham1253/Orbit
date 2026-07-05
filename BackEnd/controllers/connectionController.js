const Connection = require("../models/Connection");
const Skill = require("../models/skill");
const User = require("../models/user");
const { createNotification } = require("../services/notify");
const { recordOrbitAction } = require("../services/orbitActivity");
const { creditTeaching } = require("../services/masteryActivity");

// Send a connection request
exports.requestConnection = async (req, res) => {
    try {
        const { receiverId, skillId, message } = req.body;

        if (!receiverId || !skillId) {
            return res.status(400).json({ message: "Receiver and Skill IDs are required" });
        }

        if (req.user.id === receiverId) {
            return res.status(400).json({ message: "Cannot connect with yourself" });
        }

        // Block if ANY connection already exists between these two users (any skill, any status)
        const existing = await Connection.findOne({
            $or: [
                { requester: req.user.id, receiver: receiverId },
                { requester: receiverId,  receiver: req.user.id }
            ]
        });

        if (existing) {
            const statusMsg = existing.status === 'pending'
                ? 'A connection request is already pending with this user'
                : 'You are already connected with this user';
            return res.status(400).json({ message: statusMsg });
        }

        const connection = new Connection({
            requester: req.user.id,
            receiver: receiverId,
            skill: skillId,
            message: message || ""
        });

        await connection.save();

        // Emit socket event to receiver for real-time notification
        const io = req.app.get("io");
        if (io) {
            const requesterUser = await User.findById(req.user.id).select("name avatar");
            const skillData = await Skill.findById(skillId).select("skillOffered skillWanted");
            const reqName = requesterUser?.name || "Someone";
            const offered = skillData?.skillOffered || "a skill";

            // Persist + keep the existing live "connection-request" toast.
            await createNotification(io, receiverId, {
                type: "connection_request",
                title: "New Connection Request",
                body: `${reqName} wants to connect with you for ${offered}.`,
                data: { otherUserId: String(req.user.id), link: "/connections?tab=requests" },
                legacy: {
                    event: "connection-request",
                    payload: {
                        requester: { _id: req.user.id, name: reqName, avatar: requesterUser?.avatar },
                        skill: { skillOffered: offered, skillWanted: skillData?.skillWanted },
                        message: message || "",
                    },
                },
            });
        }

        res.status(201).json({ message: "Connection request sent!", connection });

    } catch (err) {
        console.error(err);
        if (err.code === 11000) {
            return res.status(400).json({ message: "Connection request already exists" });
        }
        res.status(500).json({ message: "Server error" });
    }
};

// Get pending connection requests (both incoming and outgoing)
exports.getPendingConnections = async (req, res) => {
    try {
        const incoming = await Connection.find({ receiver: req.user.id, status: "pending" })
            .populate("requester", "name email trustScore location avatar")
            .populate("skill", "skillOffered skillWanted level")
            .sort({ createdAt: -1 })
            .lean();

        const outgoing = await Connection.find({ requester: req.user.id })
            .populate("receiver", "name email trustScore location avatar")
            .populate("skill", "skillOffered")
            .sort({ createdAt: -1 })
            .lean();

        res.status(200).json({
            incomingCount: incoming.length,
            incoming,
            outgoing
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
};

// Get ALL connections (established) - deduplicated by unique other user
exports.getMyConnections = async (req, res) => {
    try {
        const userId = req.user.id;

        const connections = await Connection.find({
            $or: [{ requester: userId }, { receiver: userId }],
            status: 'accepted'
        })
        .populate('requester', 'name email trustScore location avatar')
        .populate('receiver',  'name email trustScore location avatar')
        .populate('skill', 'skillOffered skillWanted level')
        .sort({ updatedAt: -1 })
        .lean();

        // Deduplicate: keep only the FIRST accepted connection per unique other user
        const seenUsers = new Set();
        const unique = connections.filter(conn => {
            const otherId = conn.requester._id.toString() === userId
                ? conn.receiver._id.toString()
                : conn.requester._id.toString();
            if (seenUsers.has(otherId)) return false;
            seenUsers.add(otherId);
            return true;
        });

        res.status(200).json(unique);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

// Get completed connections (swaps that are marked as completed)
exports.getCompletedConnections = async (req, res) => {
    try {
        const userId = req.user.id;

        const connections = await Connection.find({
            $or: [{ requester: userId }, { receiver: userId }],
            status: 'completed'
        })
        .populate('requester', 'name email trustScore location avatar totalRatings')
        .populate('receiver',  'name email trustScore location avatar totalRatings')
        .populate('skill', 'skillOffered skillWanted level')
        .sort({ completedAt: -1, updatedAt: -1 })
        .lean();

        // Deduplicate by unique other user
        const seenUsers = new Set();
        const unique = connections.filter(conn => {
            const otherId = conn.requester._id.toString() === userId
                ? conn.receiver._id.toString()
                : conn.requester._id.toString();
            if (seenUsers.has(otherId)) return false;
            seenUsers.add(otherId);
            return true;
        });

        res.status(200).json(unique);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
};

// Mark a connection as completed
exports.markConnectionCompleted = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const connection = await Connection.findOne({
            _id: id,
            $or: [{ requester: userId }, { receiver: userId }],
            status: 'accepted'
        });

        if (!connection) {
            return res.status(404).json({ message: "Connection not found or not accepted" });
        }

        connection.status = 'completed';
        connection.completedAt = new Date();
        await connection.save();

        res.status(200).json({ message: "Connection marked as completed", connection });

        // Orbit Engine: a completed swap is a real-progress day for BOTH partners
        // (one taught, one learned). Fire-and-forget — never affects the response.
        const io = req.app.get("io");
        recordOrbitAction(io, connection.requester, "swap");
        recordOrbitAction(io, connection.receiver, "swap");

        // Skill Mastery: credit the owner of the swapped skill with one session
        // taught (advances their per-skill mastery ladder). Fire-and-forget.
        creditTeaching(io, connection.skill);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
};

// Respond to a connection request (accept/decline)
exports.respondConnection = async (req, res) => {
    try {
        const { action } = req.body; // "accepted" or "declined"
        const { id } = req.params;

        if (!["accepted", "declined"].includes(action)) {
            return res.status(400).json({ message: "Invalid action" });
        }

        const connection = await Connection.findOne({ _id: id, receiver: req.user.id });

        if (!connection) {
            return res.status(404).json({ message: "Connection request not found" });
        }

        if (connection.status !== "pending") {
            return res.status(400).json({ message: "Request already processed" });
        }

        connection.status = action;
        await connection.save();

        if (action === "accepted") {
            const io = req.app.get("io");
            if (io) {
                const receiverUser = await User.findById(req.user.id).select("name avatar");
                const accepterName = receiverUser ? receiverUser.name : "Someone";

                // Persist + keep the existing live "connection-accepted" toast.
                await createNotification(io, connection.requester, {
                    type: "connection_accepted",
                    title: "Request Accepted!",
                    body: `${accepterName} accepted your connection request. You can now call them!`,
                    data: { otherUserId: String(req.user.id), link: "/connections" },
                    legacy: {
                        event: "connection-accepted",
                        payload: { receiverName: accepterName, receiverAvatar: receiverUser?.avatar },
                    },
                });
            }
        }

        res.status(200).json({ message: `Request ${action}`, connection });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
};

// Cancel an outgoing connection request
exports.cancelConnection = async (req, res) => {
    try {
        const { id } = req.params;

        const connection = await Connection.findOne({ _id: id, requester: req.user.id });

        if (!connection) {
            return res.status(404).json({ message: "Connection request not found" });
        }

        if (connection.status !== "pending") {
            return res.status(400).json({ message: "Can only cancel pending requests" });
        }

        await connection.deleteOne();

        res.status(200).json({ message: "Request cancelled successfully" });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
};
