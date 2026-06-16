/**
 * adminRecordsController.js — raw records browser, the safe deletion pipeline,
 * and the append-only audit-log viewer.
 *
 * Deletion safety (spec §3.5):
 *  - SOFT delete is the default: status=soft_deleted + deletedAt/By + bannedUntil
 *    (reuses the existing login block), fully RESTORABLE.
 *  - HARD delete is a separate, clearly-labeled GDPR full erasure: requires a
 *    typed email confirmation + reason, shows a cascade preview first, snapshots
 *    the user into the audit log, then removes the user and all related docs.
 *  - The AuditLog itself has NO delete path anywhere.
 */
const User = require("../models/user");
const Rating = require("../models/rating");
const Connection = require("../models/Connection");
const CallHistory = require("../models/callHistory");
const Message = require("../models/Message");
const Skill = require("../models/skill");
const Report = require("../models/Report");
const RankEvent = require("../models/RankEvent");
const Legend = require("../models/Legend");
const AuditLog = require("../models/AuditLog");
const { audit } = require("../utils/adminAudit");

// Browsable collections (read-only). `select` redacts secrets where needed.
const COLLECTIONS = {
    users: { model: User, select: "-password -admin.passwordHash -admin.totpSecretEnc -admin.backupCodeHashes -resetPasswordToken -resetPasswordExpires" },
    ratings: { model: Rating, select: "" },
    connections: { model: Connection, select: "" },
    messages: { model: Message, select: "" },
    calls: { model: CallHistory, select: "" },
    skills: { model: Skill, select: "" },
    reports: { model: Report, select: "" },
    rankEvents: { model: RankEvent, select: "" },
    legends: { model: Legend, select: "" },
};

// GET /records/:collection?q&page&limit
exports.listRecords = async (req, res) => {
    try {
        const def = COLLECTIONS[req.params.collection];
        if (!def) return res.status(404).end();
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
        const q = (req.query.q || "").trim();
        let filter = {};
        if (q) {
            // Try an ObjectId match first, else a loose text-ish match on common fields.
            if (/^[a-f0-9]{24}$/i.test(q)) filter = { _id: q };
            else {
                const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
                filter = { $or: [{ name: rx }, { email: rx }, { content: rx }, { review: rx }, { city: rx }] };
            }
        }
        let rows = [];
        let total = 0;
        try {
            [rows, total] = await Promise.all([
                def.model.find(filter).select(def.select).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
                def.model.countDocuments(filter),
            ]);
        } catch {
            // A bad regex/filter field for this collection → fall back to unfiltered.
            [rows, total] = await Promise.all([
                def.model.find({}).select(def.select).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
                def.model.countDocuments({}),
            ]);
        }
        await audit(req, { actorId: req.adminUser._id, actorEmail: req.adminUser.email, action: "records.browse", targetType: req.params.collection });
        return res.json({ collection: req.params.collection, rows, total, page, limit, pages: Math.ceil(total / limit) });
    } catch (err) {
        console.error("[admin listRecords]", err.message);
        return res.status(500).json({ message: "Failed to load records." });
    }
};

// Count everything that references a user (cascade preview).
async function cascadeCounts(userId) {
    const [ratingsAuthored, ratingsReceived, connections, calls, messages, skills, reports, rankEvents, legends] = await Promise.all([
        Rating.countDocuments({ fromUser: userId }),
        Rating.countDocuments({ toUser: userId }),
        Connection.countDocuments({ $or: [{ requester: userId }, { receiver: userId }] }),
        CallHistory.countDocuments({ $or: [{ caller: userId }, { receiver: userId }] }),
        Message.countDocuments({ $or: [{ sender: userId }, { receiver: userId }] }),
        Skill.countDocuments({ userId }),
        Report.countDocuments({ $or: [{ targetUserId: userId }, { reporterId: userId }] }),
        RankEvent.countDocuments({ userId }),
        Legend.countDocuments({ userId }),
    ]);
    return { profile: 1, ratingsAuthored, ratingsReceived, connections, calls, messages, skills, reports, rankEvents, legends };
}

// GET /records/users/:id/delete-preview
exports.deletePreview = async (req, res) => {
    try {
        const u = await User.findById(req.params.id).select("name email status").lean();
        if (!u) return res.status(404).json({ message: "Not found" });
        const cascade = await cascadeCounts(u._id);
        return res.json({ user: { id: u._id, name: u.name, email: u.email, status: u.status }, cascade });
    } catch (err) {
        console.error("[admin deletePreview]", err.message);
        return res.status(500).json({ message: "Preview failed." });
    }
};

// POST /records/users/:id/soft-delete { reason }
exports.softDelete = async (req, res) => {
    try {
        if (String(req.params.id) === String(req.adminUser._id)) return res.status(400).json({ message: "You cannot delete your own account." });
        const u = await User.findById(req.params.id).select("name email status role").lean();
        if (!u) return res.status(404).json({ message: "Not found" });
        if (u.role === "admin") return res.status(400).json({ message: "Refusing to delete an admin account." });
        await User.updateOne({ _id: u._id }, { $set: {
            status: "soft_deleted", deletedAt: new Date(), deletedBy: req.adminUser._id,
            bannedUntil: new Date("9999-01-01T00:00:00Z"),
        } });
        await audit(req, { actorId: req.adminUser._id, actorEmail: req.adminUser.email, action: "records.softDelete", targetType: "user", targetId: String(u._id), reason: req.body.reason || "", before: { status: u.status }, after: { status: "soft_deleted" } });
        return res.json({ ok: true });
    } catch (err) {
        console.error("[admin softDelete]", err.message);
        return res.status(500).json({ message: "Soft delete failed." });
    }
};

// POST /records/users/:id/restore
exports.restore = async (req, res) => {
    try {
        const u = await User.findById(req.params.id).select("name email status").lean();
        if (!u) return res.status(404).json({ message: "Not found" });
        await User.updateOne({ _id: u._id }, { $set: { status: "active", deletedAt: null, deletedBy: null, bannedUntil: null } });
        await audit(req, { actorId: req.adminUser._id, actorEmail: req.adminUser.email, action: "records.restore", targetType: "user", targetId: String(u._id), before: { status: u.status }, after: { status: "active" } });
        return res.json({ ok: true });
    } catch (err) {
        console.error("[admin restore]", err.message);
        return res.status(500).json({ message: "Restore failed." });
    }
};

// POST /records/users/:id/hard-delete { confirmEmail, reason }  — GDPR full erasure
exports.hardDelete = async (req, res) => {
    try {
        const { confirmEmail, reason } = req.body;
        if (String(req.params.id) === String(req.adminUser._id)) return res.status(400).json({ message: "You cannot delete your own account." });
        const u = await User.findById(req.params.id).select("-password -admin.passwordHash -admin.totpSecretEnc -admin.backupCodeHashes").lean();
        if (!u) return res.status(404).json({ message: "Not found" });
        if (u.role === "admin") return res.status(400).json({ message: "Refusing to hard-delete an admin account." });
        if (!reason || !reason.trim()) return res.status(400).json({ message: "A reason is required." });
        if (!confirmEmail || confirmEmail.toLowerCase().trim() !== String(u.email).toLowerCase()) {
            return res.status(400).json({ message: "Confirmation email does not match." });
        }

        const cascade = await cascadeCounts(u._id);
        // Snapshot BEFORE removal so the audit row preserves what was erased.
        await audit(req, {
            actorId: req.adminUser._id, actorEmail: req.adminUser.email,
            action: "records.hardDelete", targetType: "user", targetId: String(u._id),
            reason, before: { user: u, cascade }, after: null,
        });

        // GDPR full erasure across all collections that reference the user.
        await Promise.all([
            Rating.deleteMany({ $or: [{ fromUser: u._id }, { toUser: u._id }] }),
            Connection.deleteMany({ $or: [{ requester: u._id }, { receiver: u._id }] }),
            CallHistory.deleteMany({ $or: [{ caller: u._id }, { receiver: u._id }] }),
            Message.deleteMany({ $or: [{ sender: u._id }, { receiver: u._id }] }),
            Skill.deleteMany({ userId: u._id }),
            Report.deleteMany({ $or: [{ targetUserId: u._id }, { reporterId: u._id }] }),
            RankEvent.deleteMany({ userId: u._id }),
            Legend.deleteMany({ userId: u._id }),
        ]);
        await User.deleteOne({ _id: u._id });

        return res.json({ ok: true, erased: cascade });
    } catch (err) {
        console.error("[admin hardDelete]", err.message);
        return res.status(500).json({ message: "Hard delete failed." });
    }
};

// GET /audit?action&actorId&page  — append-only viewer (no delete path exists)
exports.listAudit = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 40));
        const filter = {};
        if (req.query.action) filter.action = new RegExp(req.query.action.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
        if (req.query.actorId) filter.actorId = req.query.actorId;
        const [rows, total] = await Promise.all([
            AuditLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)
                .populate("actorId", "name email").lean(),
            AuditLog.countDocuments(filter),
        ]);
        return res.json({ rows, total, page, limit, pages: Math.ceil(total / limit) });
    } catch (err) {
        console.error("[admin listAudit]", err.message);
        return res.status(500).json({ message: "Failed to load audit log." });
    }
};
