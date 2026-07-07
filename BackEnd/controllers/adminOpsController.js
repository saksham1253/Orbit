/**
 * adminOpsController.js — Calls ops + Skills taxonomy + Review moderation
 * (spec H + I). Read observability plus targeted, audited moderation:
 *   • Calls    — list recent/active call sessions (CallHistory) for monitoring.
 *   • Skills   — CRUD an admin-managed skill-category taxonomy (net-new).
 *   • Reviews  — list + hide/restore reported or abusive reviews (soft, reversible).
 *
 * Category writes require the "catalog" role; review moderation requires the
 * "moderator" role. All mutations are audited.
 */
const CallHistory = require("../models/callHistory");
const SkillCategory = require("../models/SkillCategory");
const Rating = require("../models/rating");
const { audit } = require("../utils/adminAudit");

// ── Calls monitoring (H) ──────────────────────────────────────────────────────

// GET /ops/calls?status=&page=&limit= — recent call sessions for monitoring.
exports.listCalls = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
        const filter = {};
        if (["ringing", "accepted", "declined", "missed", "ended"].includes(req.query.status)) filter.status = req.query.status;
        const [rows, total, active] = await Promise.all([
            CallHistory.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)
                .populate("caller", "name email").populate("receiver", "name email").lean(),
            CallHistory.countDocuments(filter),
            CallHistory.countDocuments({ status: { $in: ["ringing", "accepted"] } }),
        ]);
        return res.json({ rows, total, active, page, limit, pages: Math.ceil(total / limit) });
    } catch (err) {
        console.error("[admin ops.listCalls]", err.message);
        return res.status(500).json({ message: "Failed to load call sessions." });
    }
};

// ── Skill taxonomy (I) ────────────────────────────────────────────────────────

exports.listCategories = async (req, res) => {
    try {
        const rows = await SkillCategory.find().sort({ sortOrder: 1, label: 1 }).lean();
        return res.json({ rows });
    } catch (err) {
        console.error("[admin ops.listCategories]", err.message);
        return res.status(500).json({ message: "Failed to load categories." });
    }
};

exports.createCategory = async (req, res) => {
    try {
        const b = req.body || {};
        if (!b.slug || !/^[a-z0-9-]+$/.test(b.slug)) return res.status(400).json({ message: "slug is required (lowercase, digits, dashes)." });
        if (!b.label) return res.status(400).json({ message: "label is required." });
        if (await SkillCategory.findOne({ slug: b.slug }).lean()) return res.status(409).json({ message: "That slug already exists." });
        const aliases = Array.isArray(b.aliases) ? b.aliases : String(b.aliases || "").split(",").map((s) => s.trim()).filter(Boolean);
        const doc = await SkillCategory.create({ slug: b.slug, label: b.label, aliases, parent: b.parent || null, sortOrder: b.sortOrder || 0, updatedBy: req.adminUser.email });
        await audit(req, { actorId: req.adminUser._id, actorEmail: req.adminUser.email, action: "skills.category.create", targetType: "skill_category", targetId: doc.slug, after: doc.toObject() });
        return res.json({ ok: true, category: doc });
    } catch (err) {
        console.error("[admin ops.createCategory]", err.message);
        return res.status(500).json({ message: "Create failed." });
    }
};

exports.updateCategory = async (req, res) => {
    try {
        const before = await SkillCategory.findOne({ slug: req.params.slug }).lean();
        if (!before) return res.status(404).json({ message: "Not found" });
        const b = req.body || {};
        const $set = { updatedBy: req.adminUser.email };
        for (const f of ["label", "parent", "active", "sortOrder"]) if (b[f] !== undefined) $set[f] = b[f];
        if (b.aliases !== undefined) $set.aliases = Array.isArray(b.aliases) ? b.aliases : String(b.aliases).split(",").map((s) => s.trim()).filter(Boolean);
        await SkillCategory.updateOne({ slug: req.params.slug }, { $set });
        const after = await SkillCategory.findOne({ slug: req.params.slug }).lean();
        await audit(req, { actorId: req.adminUser._id, actorEmail: req.adminUser.email, action: "skills.category.update", targetType: "skill_category", targetId: req.params.slug, before, after });
        return res.json({ ok: true, category: after });
    } catch (err) {
        console.error("[admin ops.updateCategory]", err.message);
        return res.status(500).json({ message: "Update failed." });
    }
};

// ── Review moderation (I) ─────────────────────────────────────────────────────

// GET /ops/reviews?hidden=&page=&limit= — reviews for moderation (recent first).
exports.listReviews = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
        const filter = {};
        if (req.query.hidden === "true") filter.hidden = true;
        else if (req.query.hidden === "false") filter.hidden = { $ne: true };
        // Only surface reviews that actually have text to moderate.
        filter.review = { $ne: "" };
        const [rows, total] = await Promise.all([
            Rating.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)
                .populate("fromUser", "name email").populate("toUser", "name email").lean(),
            Rating.countDocuments(filter),
        ]);
        return res.json({ rows, total, page, limit, pages: Math.ceil(total / limit) });
    } catch (err) {
        console.error("[admin ops.listReviews]", err.message);
        return res.status(500).json({ message: "Failed to load reviews." });
    }
};

// POST /ops/reviews/:id/hide { reason } and /restore — soft, reversible.
exports.setReviewHidden = (hide) => async (req, res) => {
    try {
        const before = await Rating.findById(req.params.id).lean();
        if (!before) return res.status(404).json({ message: "Not found" });
        if (hide && !(req.body?.reason || "").trim()) return res.status(400).json({ message: "A reason is required (audited)." });
        await Rating.updateOne({ _id: req.params.id }, hide
            ? { $set: { hidden: true, hiddenBy: req.adminUser._id, hiddenAt: new Date(), hiddenReason: String(req.body.reason).trim() } }
            : { $set: { hidden: false, hiddenBy: null, hiddenAt: null, hiddenReason: "" } });
        await audit(req, {
            actorId: req.adminUser._id, actorEmail: req.adminUser.email,
            action: hide ? "review.hide" : "review.restore", targetType: "review", targetId: req.params.id,
            reason: hide ? String(req.body.reason).trim() : "", before: { hidden: !!before.hidden }, after: { hidden: hide },
        });
        return res.json({ ok: true, hidden: hide });
    } catch (err) {
        console.error("[admin ops.setReviewHidden]", err.message);
        return res.status(500).json({ message: "Moderation failed." });
    }
};
