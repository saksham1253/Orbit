/**
 * adminController.js — data endpoints for the Admin Command Center. Every
 * handler runs behind requireAdmin (RBAC + 404 cloak). This file grows over the
 * later commits (users, records, cosmic, etc.); this commit ships the Overview.
 */
const User = require("../models/user");
const Connection = require("../models/Connection");
const Report = require("../models/Report");
const RankEvent = require("../models/RankEvent");
const CallHistory = require("../models/callHistory");
const { audit } = require("../utils/adminAudit");

// Map a tierId ("pulsar_2") → its category ("pulsar") for distribution buckets.
const categoryOf = (tierId) => String(tierId || "moon_4").split("_")[0];
const CATEGORY_ORDER = [
    "stardust", "meteor", "asteroid", "moon", "planet",
    "star", "pulsar", "supernova", "galaxy", "quasar",
];

exports.getOverview = async (req, res) => {
    try {
        const now = Date.now();
        const d7 = new Date(now - 7 * 86400000);
        const d30 = new Date(now - 30 * 86400000);

        const [
            totalUsers, activeUsers, suspended, banned, softDeleted,
            new7, new30, totalSwaps, totalCalls, openReports,
            tierAgg, topUsers, recentSignups, recentRankEvents,
        ] = await Promise.all([
            User.countDocuments({}),
            User.countDocuments({ status: "active" }),
            User.countDocuments({ status: "suspended" }),
            User.countDocuments({ status: "banned" }),
            User.countDocuments({ status: "soft_deleted" }),
            User.countDocuments({ createdAt: { $gte: d7 } }),
            User.countDocuments({ createdAt: { $gte: d30 } }),
            Connection.countDocuments({ status: "completed" }),
            CallHistory.countDocuments({}),
            Report.countDocuments({ status: "open" }),
            User.aggregate([{ $group: { _id: "$cosmic.tierId", n: { $sum: 1 } } }]),
            User.find({ status: { $ne: "soft_deleted" } })
                .sort({ "cosmic.score": -1 }).limit(5)
                .select("name avatar cosmic.score cosmic.tierId city").lean(),
            User.find({}).sort({ createdAt: -1 }).limit(6)
                .select("name email avatar createdAt role status").lean(),
            RankEvent.find({}).sort({ createdAt: -1 }).limit(10)
                .populate("userId", "name avatar").lean(),
        ]);

        // Roll per-tier counts up into category buckets, ordered low→high.
        const byCategory = {};
        for (const row of tierAgg) {
            const c = categoryOf(row._id);
            byCategory[c] = (byCategory[c] || 0) + row.n;
        }
        const tierDistribution = CATEGORY_ORDER.map((c) => ({ category: c, count: byCategory[c] || 0 }));

        await audit(req, {
            actorId: req.adminUser._id, actorEmail: req.adminUser.email,
            action: "overview.view", success: true,
        });

        return res.json({
            kpis: {
                totalUsers, activeUsers, suspended, banned, softDeleted,
                newUsers7d: new7, newUsers30d: new30,
                totalSwaps, totalCalls, openReports,
            },
            tierDistribution,
            northStar: topUsers[0] || null,
            topUsers,
            recentSignups,
            recentRankEvents,
        });
    } catch (err) {
        console.error("[admin overview]", err.message);
        return res.status(500).json({ message: "Failed to load overview." });
    }
};
