/**
 * adminCosmicController.js — cosmic observability for the Command Center:
 * the full rank-event log, the Quasar registry / Legends archive, a per-user
 * CosmicScore inspector, and audited manual controls (recompute / tier override).
 *
 * Read paths reuse the live cosmic services so the inspector matches exactly what
 * the user-facing system computes. Overrides are display-layer only and audited;
 * the scoring math is never modified.
 */
const User = require("../models/user");
const Rating = require("../models/rating");
const Connection = require("../models/Connection");
const Legend = require("../models/Legend");
const RankEvent = require("../models/RankEvent");
const { computeCosmicScore } = require("../services/cosmicScore");
const { resolveDisplayTier, higherTier } = require("../services/cosmicTier");
const { audit } = require("../utils/adminAudit");

// GET /cosmic/rank-events?direction&userId&page&limit
exports.listRankEvents = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
        const filter = {};
        if (["up", "down"].includes(req.query.direction)) filter.direction = req.query.direction;
        if (req.query.userId) filter.userId = req.query.userId;
        const [rows, total] = await Promise.all([
            RankEvent.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)
                .populate("userId", "name avatar").lean(),
            RankEvent.countDocuments(filter),
        ]);
        return res.json({ rows, total, page, limit, pages: Math.ceil(total / limit) });
    } catch (err) {
        console.error("[admin rankEvents]", err.message);
        return res.status(500).json({ message: "Failed to load rank events." });
    }
};

// GET /cosmic/quasar — Legends archive + current quasar-glow holders
exports.quasarRegistry = async (req, res) => {
    try {
        const [legends, current] = await Promise.all([
            Legend.find({}).sort({ archivedAt: -1 }).limit(200).populate("userId", "name avatar").lean(),
            User.find({ "cosmic.nameGlowTier": "quasar" }).select("name avatar cosmic.tierId cosmic.peakTierId city").lean(),
        ]);
        return res.json({ legends, current });
    } catch (err) {
        console.error("[admin quasar]", err.message);
        return res.status(500).json({ message: "Failed to load Quasar registry." });
    }
};

// Recompute a user's live CosmicScore (mirrors getMentorCosmic).
async function computeFor(user) {
    const now = Date.now();
    const ratings = await Rating.find({ toUser: user._id })
        .select("fromUser score sentiment.score tiedToCompletedSwap createdAt").lean();
    const reviewerCounts = new Map();
    for (const r of ratings) {
        const k = String(r.fromUser);
        reviewerCounts.set(k, (reviewerCounts.get(k) || 0) + 1);
    }
    const reviews = ratings.map((r) => ({
        rating: r.score,
        sentiment: r.sentiment && r.sentiment.score != null ? r.sentiment.score : null,
        ageDays: (now - new Date(r.createdAt).getTime()) / 86400000,
        reviewsFromThisReviewer: reviewerCounts.get(String(r.fromUser)) || 1,
        tiedToCompletedSwap: !!r.tiedToCompletedSwap,
    }));
    const completedSwaps = await Connection.countDocuments({
        status: "completed", $or: [{ requester: user._id }, { receiver: user._id }],
    });
    const result = computeCosmicScore({
        reviews, completedSwaps,
        activeDaysThisSeason: (user.cosmic && user.cosmic.activeDaysThisSeason) || 0,
        sentimentEnabled: process.env.COSMIC_SENTIMENT_ENABLED !== "false",
    });
    const anchorTier = (user.cosmic && user.cosmic.tierId) || "moon_4";
    const tier = resolveDisplayTier(result.score, anchorTier, { weightedReviews: result.weightedReviews, seasonsPlayed: 0 });
    return { result, tier, anchorTier, ratingsCount: ratings.length, completedSwaps };
}

// GET /cosmic/score/:userId — inspector
exports.scoreInspector = async (req, res) => {
    try {
        const user = await User.findById(req.params.userId).select("name avatar cosmic city").lean();
        if (!user) return res.status(404).json({ message: "Not found" });
        const { result, tier, anchorTier, ratingsCount, completedSwaps } = await computeFor(user);
        const history = await RankEvent.find({ userId: user._id }).sort({ createdAt: -1 }).limit(30).lean();
        await audit(req, { actorId: req.adminUser._id, actorEmail: req.adminUser.email, action: "cosmic.inspect", targetType: "user", targetId: String(user._id) });
        return res.json({
            user: { id: user._id, name: user.name, city: user.city },
            stored: user.cosmic,
            live: {
                score: Math.round(result.score * 10) / 10,
                weightedReviews: result.weightedReviews,
                tierId: tier.tierId,
                displayName: tier.displayName,
                direction: tier.direction,
                gated: tier.gated,
                gateReason: tier.gateReason,
                anchorTier,
                hysteresis: tier.tierId !== anchorTier ? "would change on next read" : "stable",
            },
            components: result.components || null,
            inputs: { ratingsCount, completedSwaps },
            history,
        });
    } catch (err) {
        console.error("[admin scoreInspector]", err.message);
        return res.status(500).json({ message: "Failed to inspect score." });
    }
};

// POST /cosmic/score/:userId/recompute — persist a fresh compute (audited)
exports.recompute = async (req, res) => {
    try {
        const user = await User.findById(req.params.userId).select("name cosmic").lean();
        if (!user) return res.status(404).json({ message: "Not found" });
        const { result, tier } = await computeFor(user);
        const peakId = higherTier((user.cosmic && user.cosmic.peakTierId) || "moon_4", tier.tierId);
        const before = { tierId: user.cosmic?.tierId, score: user.cosmic?.score };
        await User.updateOne({ _id: user._id }, { $set: {
            "cosmic.tierId": tier.tierId, "cosmic.peakTierId": peakId,
            "cosmic.score": Math.round(result.score * 10) / 10, "cosmic.lastTierChangeAt": new Date(),
        } });
        await audit(req, { actorId: req.adminUser._id, actorEmail: req.adminUser.email, action: "cosmic.recompute", targetType: "user", targetId: String(user._id), reason: req.body.reason || "", before, after: { tierId: tier.tierId, score: Math.round(result.score * 10) / 10 } });
        return res.json({ ok: true, tierId: tier.tierId, score: Math.round(result.score * 10) / 10 });
    } catch (err) {
        console.error("[admin recompute]", err.message);
        return res.status(500).json({ message: "Recompute failed." });
    }
};

// POST /cosmic/score/:userId/override { tierId, reason } — display-layer override (audited)
exports.overrideTier = async (req, res) => {
    try {
        const tierId = req.body.tierId;
        const reason = req.body.reason || "";
        if (!tierId) return res.status(400).json({ message: "tierId required." });
        if (!reason.trim()) return res.status(400).json({ message: "A reason is required for overrides." });
        const before = await User.findById(req.params.userId).select("cosmic.tierId name").lean();
        if (!before) return res.status(404).json({ message: "Not found" });
        await User.updateOne({ _id: req.params.userId }, { $set: { "cosmic.tierId": tierId, "cosmic.lastTierChangeAt": new Date() } });
        // Record the override as an admin-triggered rank event for traceability.
        await RankEvent.create({
            userId: req.params.userId, scope: "global",
            fromTierId: before.cosmic?.tierId || "moon_4", toTierId: tierId,
            direction: "up", trigger: "admin",
        }).catch(() => {});
        await audit(req, { actorId: req.adminUser._id, actorEmail: req.adminUser.email, action: "cosmic.override", targetType: "user", targetId: req.params.userId, reason, before: { tierId: before.cosmic?.tierId }, after: { tierId } });
        return res.json({ ok: true });
    } catch (err) {
        console.error("[admin overrideTier]", err.message);
        return res.status(500).json({ message: "Override failed." });
    }
};
