const mongoose = require("mongoose");
const CallHistory = require("../models/callHistory");
const Connection = require("../models/Connection");

/**
 * Verify a user is a legitimate participant of a session room, for gating
 * whiteboard reads/writes. A room is identified either by:
 *   • a CallHistory.roomName (the deterministic call room), or
 *   • a Connection _id (the /call/:roomId entry point where roomId = connection id).
 *
 * Returns { ok, participants } — participants is the [a, b] user id pair when
 * known, so callers can stamp Whiteboard.participants.
 */
async function verifyRoomMember(userId, roomName) {
    if (!userId || !roomName) return { ok: false, participants: [] };
    const uid = String(userId);

    const call = await CallHistory.findOne({
        roomName,
        $or: [{ caller: userId }, { receiver: userId }],
    }).select("caller receiver").lean();
    if (call) return { ok: true, participants: [call.caller, call.receiver] };

    if (mongoose.isValidObjectId(roomName)) {
        const conn = await Connection.findOne({
            _id: roomName,
            $or: [{ requester: userId }, { receiver: userId }],
        }).select("requester receiver").lean();
        if (conn) return { ok: true, participants: [conn.requester, conn.receiver] };
    }

    // Fallback: any CallHistory for this room that lists the user (covers races
    // where the status query above didn't match).
    const any = await CallHistory.findOne({ roomName }).select("caller receiver").lean();
    if (any && (String(any.caller) === uid || String(any.receiver) === uid)) {
        return { ok: true, participants: [any.caller, any.receiver] };
    }

    return { ok: false, participants: [] };
}

module.exports = { verifyRoomMember };
