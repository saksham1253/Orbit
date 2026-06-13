const User = require("../models/user");
const Rating = require("../models/rating");
const Connection = require("../models/Connection");
const { buildLeaderboard } = require("../services/leaderboardService");
const { computeCosmicScore } = require("../services/cosmicScore");
const { assignTier } = require("../services/cosmicTier");

// ─────────────────────────────────────────────────────────────
//  GET /api/cosmic/leaderboard
//  Query: scope, lat, lng, skill?, season?
//  Falls back to the viewer's stored coordinates when lat/lng omitted.
// ─────────────────────────────────────────────────────────────
exports.getLeaderboard = async (req, res) => {
    try {
        const scope = ["neighborhood", "city", "region", "country"].includes(req.query.scope)
            ? req.query.scope : "city";
        const season = req.query.season || "";

        const me = await User.findById(req.user.id)
            .select("name city region country coordinates geo cosmic")
            .lean();
        if (!me) return res.status(404).json({ message: "User not found" });

        // Resolve a location: explicit query → viewer's saved coords → 400.
        let lat = req.query.lat != null ? parseFloat(req.query.lat) : null;
        let lng = req.query.lng != null ? parseFloat(req.query.lng) : null;
        if ((lat == null || Number.isNaN(lat)) && me.coordinates && me.coordinates.lat != null) {
            lat = me.coordinates.lat; lng = me.coordinates.lng;
        }
        // Region/country scopes can work off admin fields without coordinates.
        const needsCoords = scope === "neighborhood" || scope === "city";
        if (needsCoords && (lat == null || Number.isNaN(lat))) {
            return res.status(400).json({
                message: "Set your location first (Nearby) or pass lat/lng to use a distance-based board.",
                needsLocation: true,
            });
        }

        const payload = await buildLeaderboard({ me, lat, lng, scope, season });
        return res.status(200).json(payload);
    } catch (err) {
        console.error("getLeaderboard error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// ─────────────────────────────────────────────────────────────
//  GET /api/cosmic/mentor/:id  — one mentor's cosmic profile (on-read)
// ─────────────────────────────────────────────────────────────
exports.getMentorCosmic = async (req, res) => {
    try {
        const mentor = await User.findById(req.params.id).select("name cosmic").lean();
        if (!mentor) return res.status(404).json({ message: "User not found" });

        const now = Date.now();
        const ratings = await Rating.find({ toUser: mentor._id })
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
            status: "completed",
            $or: [{ requester: mentor._id }, { receiver: mentor._id }],
        });

        const result = computeCosmicScore({
            reviews,
            completedSwaps,
            activeDaysThisSeason: (mentor.cosmic && mentor.cosmic.activeDaysThisSeason) || 0,
            sentimentEnabled: process.env.COSMIC_SENTIMENT_ENABLED !== "false",
        });
        const tier = assignTier(result.score, { weightedReviews: result.weightedReviews, seasonsPlayed: 0 });
        const peakId = (mentor.cosmic && mentor.cosmic.peakTierId) || tier.tierId;

        res.status(200).json({
            tierId: tier.tierId,
            category: tier.category,
            division: tier.division,
            displayName: tier.displayName,
            score: Math.round(result.score * 10) / 10,
            peakTierId: peakId,
            progressToNext: tier.progressToNext,
            gated: tier.gated,
            gateReason: tier.gateReason,
            unlockedTitles: (mentor.cosmic && mentor.cosmic.unlockedTitles) || [],
            currentTitle: (mentor.cosmic && mentor.cosmic.currentTitle) || "",
            flair: (mentor.cosmic && mentor.cosmic.flair) || [],
            reviewsCount: ratings.length,
            weightedReviews: Math.round(result.weightedReviews * 100) / 100,
            sentimentUsed: result.sentimentUsed,
        });
    } catch (err) {
        console.error("getMentorCosmic error:", err);
        res.status(500).json({ message: "Server error" });
    }
};
