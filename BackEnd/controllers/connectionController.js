const Connection = require("../models/Connection");
const Skill = require("../models/skill");
const User = require("../models/User");

// Send a connection request
exports.requestConnection = async (req, res) => {
    try {
        const { receiverId, skillId } = req.body;

        if (!receiverId || !skillId) {
            return res.status(400).json({ message: "Receiver and Skill IDs are required" });
        }

        if (req.user.id === receiverId) {
            return res.status(400).json({ message: "Cannot connect with yourself" });
        }

        const existing = await Connection.findOne({
            requester: req.user.id,
            receiver: receiverId,
            skill: skillId
        });

        if (existing) {
            return res.status(400).json({ message: "Connection request already sent for this skill" });
        }

        const connection = new Connection({
            requester: req.user.id,
            receiver: receiverId,
            skill: skillId
        });

        await connection.save();

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
            .populate("requester", "name email trustScore location")
            .populate("skill", "skillOffered skillWanted level")
            .sort({ createdAt: -1 });

        const outgoing = await Connection.find({ requester: req.user.id })
            .populate("receiver", "name trustScore email")
            .populate("skill", "skillOffered")
            .sort({ createdAt: -1 });

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

// Get ALL connections (to verify established connections)
exports.getMyConnections = async (req, res) => {
    try {
        const connections = await Connection.find({
            $or: [{ requester: req.user.id }, { receiver: req.user.id }]
        })
        .populate("requester", "name email trustScore location")
        .populate("receiver", "name email trustScore location")
        .populate("skill", "skillOffered skillWanted level");
        
        res.status(200).json(connections);
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
                const receiverUser = await User.findById(req.user.id).select("name");
                io.to(`user_${connection.requester}`).emit("connection-accepted", {
                    receiverName: receiverUser ? receiverUser.name : "Someone"
                });
            }
        }

        res.status(200).json({ message: `Request ${action}`, connection });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
};
