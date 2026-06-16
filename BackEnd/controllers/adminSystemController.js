/**
 * adminSystemController.js — moderation queues, season/system controls, exports,
 * and the migrated storage/archive tooling (previously the weakly-guarded
 * /api/admin routes, now behind real RBAC). All mutations are audited.
 */
const User = require("../models/user");
const Report = require("../models/Report");
const RankEvent = require("../models/RankEvent");
const Season = require("../models/Season");
const Message = require("../models/Message");
const CallHistory = require("../models/callHistory");
const ChatArchive = require("../models/ChatArchive");
const CallArchive = require("../models/CallArchive");
const { getLatestSnapshot, captureStorageSnapshot } = require("../services/storageService");
const { runArchiveJob } = require("../workers/archiveWorker");
const { audit } = require("../utils/adminAudit");

// ── Moderation ──────────────────────────────────────────────────────────────
exports.listReports = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
        const filter = {};
        if (["open", "resolved", "dismissed"].includes(req.query.status)) filter.status = req.query.status;
        const [rows, total] = await Promise.all([
            Report.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)
                .populate("reporterId", "name email").populate("targetUserId", "name email status").lean(),
            Report.countDocuments(filter),
        ]);
        return res.json({ rows, total, page, limit, pages: Math.ceil(total / limit) });
    } catch (err) {
        console.error("[admin listReports]", err.message);
        return res.status(500).json({ message: "Failed to load reports." });
    }
};

exports.resolveReport = async (req, res) => {
    try {
        const status = req.body.status;
        if (!["resolved", "dismissed"].includes(status)) return res.status(400).json({ message: "Invalid status." });
        const before = await Report.findById(req.params.id).lean();
        if (!before) return res.status(404).json({ message: "Not found" });
        await Report.updateOne({ _id: req.params.id }, { $set: {
            status, adminNotes: req.body.notes || "", resolvedBy: req.adminUser._id, resolvedAt: new Date(),
        } });
        await audit(req, { actorId: req.adminUser._id, actorEmail: req.adminUser.email, action: `report.${status}`, targetType: "report", targetId: req.params.id, reason: req.body.notes || "", before: { status: before.status }, after: { status } });
        return res.json({ ok: true });
    } catch (err) {
        console.error("[admin resolveReport]", err.message);
        return res.status(500).json({ message: "Resolve failed." });
    }
};

// Anti-gaming / fraud flags (flag-only; never auto-bans).
exports.listFlags = async (req, res) => {
    try {
        const rows = await User.find({ isFlagged: true })
            .select("name email flagReason reportCount trustScore status createdAt").sort({ updatedAt: -1 }).limit(200).lean();
        return res.json({ rows });
    } catch (err) {
        console.error("[admin listFlags]", err.message);
        return res.status(500).json({ message: "Failed to load flags." });
    }
};

// ── Season / system ─────────────────────────────────────────────────────────
exports.listSeasons = async (req, res) => {
    try {
        const seasons = await Season.find({}).sort({ startsAt: -1 }).limit(36).lean();
        return res.json({ seasons });
    } catch (err) {
        console.error("[admin listSeasons]", err.message);
        return res.status(500).json({ message: "Failed to load seasons." });
    }
};

// Dry-run recompute estimate — counts mentors that WOULD be recomputed; mutates
// nothing. Real recompute happens per-user in the Cosmic inspector or on-read.
exports.recomputeDryRun = async (req, res) => {
    try {
        const mentors = await User.countDocuments({ status: { $ne: "soft_deleted" } });
        await audit(req, { actorId: req.adminUser._id, actorEmail: req.adminUser.email, action: "system.recompute_dryrun" });
        return res.json({ wouldRecompute: mentors, note: "Dry run only — no scores were changed." });
    } catch (err) {
        return res.status(500).json({ message: "Dry run failed." });
    }
};

// ── Storage / archive (migrated from legacy /api/admin, now RBAC-gated) ──────
exports.storageStats = async (req, res) => {
    try {
        let snap = await getLatestSnapshot();
        if (!snap) snap = await captureStorageSnapshot();
        return res.json(snap);
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

exports.archiveStatus = async (req, res) => {
    try {
        const [hotMessages, hotCalls, archiveChats, archiveCalls] = await Promise.all([
            Message.countDocuments(), CallHistory.countDocuments(), ChatArchive.countDocuments(), CallArchive.countDocuments(),
        ]);
        const archiveMsgCount = await ChatArchive.aggregate([{ $group: { _id: null, total: { $sum: "$messageCount" } } }]);
        return res.json({
            hot: { messages: hotMessages, callHistories: hotCalls },
            archived: { chatArchiveBuckets: archiveChats, archivedMessages: archiveMsgCount[0]?.total || 0, callArchives: archiveCalls },
        });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

exports.runArchive = async (req, res) => {
    try {
        runArchiveJob().catch((e) => console.error("[admin] archive error:", e));
        await audit(req, { actorId: req.adminUser._id, actorEmail: req.adminUser.email, action: "system.run_archive" });
        return res.json({ message: "Archive job triggered. Check server logs for progress." });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
};

// ── Exports (CSV) ───────────────────────────────────────────────────────────
function toCsv(rows, columns) {
    const esc = (v) => {
        if (v == null) return "";
        const s = String(v).replace(/"/g, '""');
        return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const header = columns.join(",");
    const body = rows.map((r) => columns.map((c) => esc(c.split(".").reduce((o, k) => (o == null ? o : o[k]), r))).join(",")).join("\n");
    return `${header}\n${body}`;
}

exports.exportUsers = async (req, res) => {
    try {
        const rows = await User.find({}).select("name email role status city country trustScore cosmic.score cosmic.tierId createdAt").limit(5000).lean();
        const csv = toCsv(rows, ["_id", "name", "email", "role", "status", "city", "country", "trustScore", "cosmic.score", "cosmic.tierId", "createdAt"]);
        await audit(req, { actorId: req.adminUser._id, actorEmail: req.adminUser.email, action: "export.users", reason: `${rows.length} rows` });
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", 'attachment; filename="users.csv"');
        return res.send(csv);
    } catch (err) {
        return res.status(500).json({ message: "Export failed." });
    }
};

exports.exportRankEvents = async (req, res) => {
    try {
        const rows = await RankEvent.find({}).sort({ createdAt: -1 }).limit(10000).lean();
        const csv = toCsv(rows, ["_id", "userId", "direction", "fromTierId", "toTierId", "scoreBefore", "scoreAfter", "trigger", "seasonId", "createdAt"]);
        await audit(req, { actorId: req.adminUser._id, actorEmail: req.adminUser.email, action: "export.rank_events", reason: `${rows.length} rows` });
        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", 'attachment; filename="rank-events.csv"');
        return res.send(csv);
    } catch (err) {
        return res.status(500).json({ message: "Export failed." });
    }
};
