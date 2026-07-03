/**
 * messageController.js — Phase 5 (cursor pagination + archive read)
 *
 * EXISTING ENDPOINTS — kept 100% backward-compatible:
 *   GET  /api/messages/conversations   → getConversations  (unchanged)
 *   GET  /api/messages/unread-count    → getUnreadCount    (unchanged)
 *   GET  /api/messages/:userId         → getConversation   (extended: cursor params + archive fallback)
 *   POST /api/messages/:userId         → sendMessage       (unchanged)
 *
 * NEW (additive):
 *   GET  /api/messages/:userId/archive → getArchivedMessages  (paginated archive read)
 *
 * Pagination strategy (Phase 5):
 *   - Default page size capped at 50 (was already 50, kept).
 *   - New optional query params: ?cursor=<ISO-date>&limit=<n>
 *   - cursor = createdAt of the OLDEST message the client has loaded → loads older messages
 *   - When hot window is exhausted (returns 0 or hasMore=false), client switches to
 *     /api/messages/:userId/archive which reads from ChatArchive (decompressed).
 */

const Message     = require('../models/Message');
const ChatArchive = require('../models/ChatArchive');
const User        = require('../models/user');
const { decompress } = require('../services/archiveService');
const { recordOrbitAction } = require('../services/orbitActivity');

const DEFAULT_LIMIT = 50;
const MAX_LIMIT     = 100;

// ─────────────────────────────────────────────────────────────
// EXISTING: GET /api/messages/:userId
// Extended: supports ?cursor=<ISO-date>&limit=<n> (safe defaults)
// Old callers using ?page=N still work (preserved for compatibility)
// ─────────────────────────────────────────────────────────────
exports.getConversation = async (req, res) => {
    try {
        const myId    = req.user.id;
        const otherId = req.params.userId;

        // ── Cursor-based pagination (Phase 5) ──
        // New clients send ?cursor=<ISO> to load messages older than that date.
        // Legacy clients send ?page=N — we keep that working too.
        const limit  = Math.min(parseInt(req.query.limit) || DEFAULT_LIMIT, MAX_LIMIT);
        const cursor = req.query.cursor ? new Date(req.query.cursor) : null;
        const page   = parseInt(req.query.page) || 1; // legacy fallback

        const baseFilter = {
            $or: [
                { sender: myId,    receiver: otherId },
                { sender: otherId, receiver: myId    },
            ],
            // Exclude messages this user has deleted "for me"
            deletedFor: { $ne: myId },
        };

        // If cursor provided, load messages older than cursor (createdAt < cursor)
        if (cursor) {
            baseFilter.createdAt = { $lt: cursor };
        } else if (!req.query.cursor) {
            // Legacy page-based: skip
            const skip = (page - 1) * limit;
            const messages = await Message.find(baseFilter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean();

            // Mark unread (side-effect, unchanged)
            await Message.updateMany(
                { sender: otherId, receiver: myId, read: false },
                { $set: { read: true } }
            );

            return res.status(200).json(messages.reverse());
        }

        // Cursor-mode query
        const messages = await Message.find(baseFilter)
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

        // Mark unread
        await Message.updateMany(
            { sender: otherId, receiver: myId, read: false },
            { $set: { read: true } }
        );

        const hasMore = messages.length === limit;
        // Return oldest-first (reverse for chat UI ascending order)
        return res.status(200).json({
            messages: messages.reverse(),
            hasMore,
            // nextCursor: oldest message's createdAt — client uses this for next scroll-up
            nextCursor: messages.length > 0 ? messages[0].createdAt : null,
        });

    } catch (err) {
        console.error('getConversation error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─────────────────────────────────────────────────────────────
// NEW: GET /api/messages/:userId/archive
// Phase 5 — read older history from ChatArchive (decompress on read)
// Params: ?yearMonth=YYYY-MM  (load one month of archive)
//         ?limit=N            (max messages to return from that archive)
// ─────────────────────────────────────────────────────────────
exports.getArchivedMessages = async (req, res) => {
    try {
        const myId     = req.user.id;
        const otherId  = req.params.userId;
        const yearMonth = req.query.yearMonth; // e.g. "2025-01"

        if (!yearMonth || !/^\d{4}-\d{2}$/.test(yearMonth)) {
            return res.status(400).json({ message: 'yearMonth param required (YYYY-MM)' });
        }

        const limit = Math.min(parseInt(req.query.limit) || DEFAULT_LIMIT, MAX_LIMIT);

        const convKey = Message.conversationKey(myId, otherId);
        const archive = await ChatArchive.findOne({
            conversationKey: convKey,
            yearMonth,
        }).lean();

        if (!archive) {
            return res.status(200).json({ messages: [], hasMore: false, yearMonth });
        }

        // Decompress (Phase 4)
        const allMessages = await decompress(archive.compressedMessages);

        // Return last `limit` messages (most recent within the archive month)
        const page   = parseInt(req.query.page) || 1;
        const start  = Math.max(0, allMessages.length - page * limit);
        const end    = allMessages.length - (page - 1) * limit;
        const slice  = allMessages.slice(start, end);

        return res.status(200).json({
            messages: slice,
            hasMore: start > 0,
            yearMonth,
            totalInMonth: allMessages.length,
        });

    } catch (err) {
        console.error('getArchivedMessages error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─────────────────────────────────────────────────────────────
// NEW: GET /api/messages/:userId/archive-months
// Returns the list of yearMonth buckets available in ChatArchive
// so the frontend knows which months to offer as "load older history"
// ─────────────────────────────────────────────────────────────
exports.getArchiveMonths = async (req, res) => {
    try {
        const myId    = req.user.id;
        const otherId = req.params.userId;
        const convKey = Message.conversationKey(myId, otherId);

        const months = await ChatArchive.find(
            { conversationKey: convKey },
            { yearMonth: 1, messageCount: 1, _id: 0 }
        ).sort({ yearMonth: -1 }).lean();

        res.status(200).json({ months });
    } catch (err) {
        console.error('getArchiveMonths error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─────────────────────────────────────────────────────────────
// EXISTING: POST /api/messages/:userId — send a message (unchanged)
// ─────────────────────────────────────────────────────────────
exports.sendMessage = async (req, res) => {
    try {
        const myId    = req.user.id;
        const otherId = req.params.userId;
        const { content } = req.body;

        if (!content || !content.trim()) {
            return res.status(400).json({ message: 'Message content is required' });
        }

        // Chat moderation: block prohibited words and WARN (no account ban).
        // Same banned-keyword list as skills/bio (incl. Hindi).
        const { checkForBannedContent } = require('../utils/bannedKeywords');
        if (!checkForBannedContent(content).isClean) {
            return res.status(400).json({
                message: '⚠️ Your message contains prohibited words and was not sent. Please keep it respectful.',
                violationType: 'content_policy',
            });
        }

        const message = await Message.create({
            sender:   myId,
            receiver: otherId,
            content:  content.trim()
        });

        const populated = await Message.findById(message._id)
            .populate('sender',   'name avatar')
            .populate('receiver', 'name avatar')
            .lean();

        // Emit via socket if available
        const io = req.app.get('io');
        if (io) {
            io.to(`user_${otherId}`).emit('new-message', populated);
        }

        // Native push (FCM) so the recipient's APK gets a tray entry even when
        // the app is killed (the socket emit above only reaches a live app).
        // Fire-and-forget; no-op when FCM is unconfigured and never throws.
        const senderName = (populated.sender && populated.sender.name) || 'Someone';
        const preview = content.trim().slice(0, 120);
        require('../services/fcm')
            .sendToUser(otherId, {
                title: `New message from ${senderName}`,
                body: preview,
                data: { link: `/dashboard?chat=${myId}`, type: 'message' },
            })
            .catch(() => {});

        res.status(201).json(populated);

        // Orbit Engine: messaging a partner is a real-progress day for the sender.
        // Fire-and-forget — never affects the response.
        recordOrbitAction(io, myId, "message");

    } catch (err) {
        console.error('sendMessage error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─────────────────────────────────────────────────────────────
// NEW: DELETE /api/messages/message/:messageId?scope=me|everyone
// "delete for me" (default) hides for the requester only; the doc is
// hard-deleted once BOTH participants have hidden it (reclaims space).
// "delete for everyone" is sender-only: wipes content + tombstone flag,
// then live-notifies the other participant via socket.
// ─────────────────────────────────────────────────────────────
exports.deleteMessage = async (req, res) => {
    try {
        const myId  = req.user.id;
        const scope = req.query.scope === 'everyone' ? 'everyone' : 'me';

        const message = await Message.findById(req.params.messageId);
        if (!message) return res.status(404).json({ message: 'Message not found' });

        const isSender   = message.sender.toString()   === myId;
        const isReceiver = message.receiver.toString() === myId;
        if (!isSender && !isReceiver) {
            return res.status(403).json({ message: 'Not authorized to delete this message' });
        }

        if (scope === 'everyone') {
            if (!isSender) {
                return res.status(403).json({ message: 'Only the sender can delete for everyone' });
            }
            // Wipe content (reclaims text) + tombstone. updateOne skips the
            // `content` required-validator so the empty string is accepted.
            await Message.updateOne(
                { _id: message._id },
                { $set: { deletedForEveryone: true, content: '' } }
            );

            const io = req.app.get('io');
            if (io) {
                const payload = { messageId: message._id.toString(), scope: 'everyone' };
                io.to(`user_${message.receiver.toString()}`).emit('message-deleted', { ...payload, otherUserId: message.sender.toString() });
                io.to(`user_${message.sender.toString()}`).emit('message-deleted',   { ...payload, otherUserId: message.receiver.toString() });
            }
            return res.status(200).json({ message: 'Message deleted for everyone', messageId: message._id, scope: 'everyone' });
        }

        // scope === 'me'
        await Message.updateOne({ _id: message._id }, { $addToSet: { deletedFor: myId } });

        // Reclaim storage if BOTH participants have now hidden it
        const updated = await Message.findById(message._id).select('deletedFor sender receiver').lean();
        const hidden  = new Set((updated.deletedFor || []).map(String));
        if (hidden.has(updated.sender.toString()) && hidden.has(updated.receiver.toString())) {
            await Message.deleteOne({ _id: message._id });
        }
        return res.status(200).json({ message: 'Message deleted', messageId: message._id, scope: 'me' });

    } catch (err) {
        console.error('deleteMessage error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─────────────────────────────────────────────────────────────
// NEW: DELETE /api/messages/conversation/:userId
// "Clear chat" — hides every message in the conversation for the
// requester, then hard-deletes the ones both participants have hidden.
// Never touches the other user's view of un-hidden messages.
// ─────────────────────────────────────────────────────────────
exports.clearConversation = async (req, res) => {
    try {
        const myId    = req.user.id;
        const otherId = req.params.userId;

        const pair = {
            $or: [
                { sender: myId,    receiver: otherId },
                { sender: otherId, receiver: myId    },
            ],
        };

        await Message.updateMany(pair, { $addToSet: { deletedFor: myId } });
        // Reclaim: drop messages now hidden by BOTH sides
        await Message.deleteMany({ ...pair, deletedFor: { $all: [myId, otherId] } });

        return res.status(200).json({ message: 'Conversation cleared', otherUserId: otherId });

    } catch (err) {
        console.error('clearConversation error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─────────────────────────────────────────────────────────────
// EXISTING: GET /api/messages/unread-count (unchanged)
// ─────────────────────────────────────────────────────────────
exports.getUnreadCount = async (req, res) => {
    try {
        const count = await Message.countDocuments({
            receiver: req.user.id,
            read: false,
            deletedFor: { $ne: req.user.id }
        });
        res.status(200).json({ count });
    } catch (err) {
        console.error('getUnreadCount error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// ─────────────────────────────────────────────────────────────
// EXISTING: GET /api/messages/conversations (unchanged — full aggregation)
// ─────────────────────────────────────────────────────────────
exports.getConversations = async (req, res) => {
    try {
        const myId = req.user.id;

        const conversations = await Message.aggregate([
            {
                $match: {
                    $or: [
                        { sender:   require('mongoose').Types.ObjectId.createFromHexString(myId) },
                        { receiver: require('mongoose').Types.ObjectId.createFromHexString(myId) }
                    ],
                    // Exclude messages this user deleted "for me" so cleared
                    // conversations drop out of the list and previews stay correct
                    deletedFor: { $ne: require('mongoose').Types.ObjectId.createFromHexString(myId) }
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
                    from:         'users',
                    localField:   '_id',
                    foreignField: '_id',
                    as:           'user'
                }
            },
            { $unwind: '$user' },
            {
                $project: {
                    'user._id':        1,
                    'user.name':       1,
                    'user.avatar':     1,
                    'user.trustScore': 1,
                    lastMessage:       1,
                    unreadCount:       1
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
