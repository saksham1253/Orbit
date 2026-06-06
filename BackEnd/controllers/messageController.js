const Message = require('../models/Message');
const User = require('../models/user');

// GET /api/messages/:userId  — fetch conversation history with a user
exports.getConversation = async (req, res) => {
    try {
        const myId = req.user.id;
        const otherId = req.params.userId;
        const page = parseInt(req.query.page) || 1;
        const limit = 50;
        const skip = (page - 1) * limit;

        const messages = await Message.find({
            $or: [
                { sender: myId, receiver: otherId },
                { sender: otherId, receiver: myId }
            ]
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

        // Mark all unread messages from the other person as read
        await Message.updateMany(
            { sender: otherId, receiver: myId, read: false },
            { $set: { read: true } }
        );

        res.status(200).json(messages.reverse());

    } catch (err) {
        console.error('getConversation error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// POST /api/messages/:userId  — send a message (REST fallback, mainly handled via Socket.io)
exports.sendMessage = async (req, res) => {
    try {
        const myId = req.user.id;
        const otherId = req.params.userId;
        const { content } = req.body;

        if (!content || !content.trim()) {
            return res.status(400).json({ message: 'Message content is required' });
        }

        const message = await Message.create({
            sender: myId,
            receiver: otherId,
            content: content.trim()
        });

        const populated = await Message.findById(message._id)
            .populate('sender', 'name avatar')
            .populate('receiver', 'name avatar')
            .lean();

        // Emit via socket if available
        const io = req.app.get('io');
        if (io) {
            io.to(`user_${otherId}`).emit('new-message', populated);
        }

        res.status(201).json(populated);

    } catch (err) {
        console.error('sendMessage error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// GET /api/messages/unread-count  — total unread messages count
exports.getUnreadCount = async (req, res) => {
    try {
        const count = await Message.countDocuments({
            receiver: req.user.id,
            read: false
        });
        res.status(200).json({ count });
    } catch (err) {
        console.error('getUnreadCount error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// GET /api/messages/conversations  — list all conversations (latest message per contact)
exports.getConversations = async (req, res) => {
    try {
        const myId = req.user.id;

        // Aggregate: group by conversation partner, pick last message
        const conversations = await Message.aggregate([
            {
                $match: {
                    $or: [
                        { sender: require('mongoose').Types.ObjectId.createFromHexString(myId) },
                        { receiver: require('mongoose').Types.ObjectId.createFromHexString(myId) }
                    ]
                }
            },
            { $sort: { createdAt: -1 } },
            {
                $group: {
                    _id: {
                        $cond: [
                            { $eq: ['$sender', require('mongoose').Types.ObjectId.createFromHexString(myId)] },
                            '$receiver',
                            '$sender'
                        ]
                    },
                    lastMessage: { $first: '$$ROOT' },
                    unreadCount: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ['$receiver', require('mongoose').Types.ObjectId.createFromHexString(myId)] },
                                        { $eq: ['$read', false] }
                                    ]
                                },
                                1, 0
                            ]
                        }
                    }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            { $unwind: '$user' },
            {
                $project: {
                    'user._id': 1,
                    'user.name': 1,
                    'user.avatar': 1,
                    'user.trustScore': 1,
                    lastMessage: 1,
                    unreadCount: 1
                }
            },
            { $sort: { 'lastMessage.createdAt': -1 } }
        ]);

        res.status(200).json(conversations);
    } catch (err) {
        console.error('getConversations error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};
