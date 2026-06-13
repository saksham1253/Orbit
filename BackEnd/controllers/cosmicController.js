const User = require("../models/user");
const Rating = require("../models/rating");
const Connection = require("../models/Connection");
const Legend = require("../models/Legend");
const { buildLeaderboard, scorePool, mentorsWithin } = require("../services/leaderboardService");
const { computeCosmicScore } = require("../services/cosmicScore");
const { assignTier, nameGlowFor, higherTier } = require("../services/cosmicTier");

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
            .select("name avatar city region country coordinates geo cosmic")
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

        // v2 §1.2 — peakTierId is monotonic: max(stored, current). Persist the
        // raise fire-and-forget so it sticks without blocking the response.
        const storedPeak = (mentor.cosmic && mentor.cosmic.peakTierId) || "moon_4";
        const peakId = higherTier(storedPeak, tier.tierId);
        const glow = nameGlowFor(tier.tierId);
        if (peakId !== storedPeak || (mentor.cosmic && mentor.cosmic.nameGlowTier) !== glow) {
            User.updateOne({ _id: mentor._id },
                { $set: { "cosmic.peakTierId": peakId, "cosmic.nameGlowTier": glow } }).catch(() => {});
        }

        res.status(200).json({
            tierId: tier.tierId,
            category: tier.category,
            division: tier.division,
            displayName: tier.displayName,
            score: Math.round(result.score * 10) / 10,
            peakTierId: peakId,
            progress: tier.progress,              // { mode, pct, label } (v2 §1.1)
            progressToNext: tier.progressToNext,
            gated: tier.gated,
            gateReason: tier.gateReason,
            nameGlowTier: glow,                   // v2 §8
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

// ─────────────────────────────────────────────────────────────
//  GET /api/cosmic/observatory/:city  — Hall of Fame for a city (spec §10)
//  North Star (#1), orbiting ranks, Supernova-of-the-Month (+ BERT-picked
//  best quote), and the Legends Archive (Quasars).
// ─────────────────────────────────────────────────────────────
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

exports.getObservatory = async (req, res) => {
    try {
        const cityParam = (req.params.city || "").trim();
        const me = await User.findById(req.user.id).select("city coordinates").lean();

        const SELECT = "name avatar city cosmic";

        // Primary pool: users whose city field matches. Fall back to a distance
        // pool around the viewer when the city field isn't populated yet.
        let pool = [];
        let label = cityParam || (me && me.city) || "your city";
        if (cityParam) {
            pool = await User.find({ city: new RegExp(`^${escapeRegex(cityParam)}$`, "i") })
                .select(SELECT).limit(200).lean();
        }
        if (pool.length < 3 && me && me.coordinates && me.coordinates.lat != null) {
            pool = await mentorsWithin(me.coordinates.lat, me.coordinates.lng, 50, me._id);
            label = cityParam || (me && me.city) || "within 50 km";
        }

        const ids = pool.map((u) => u._id);
        const scores = await scorePool(ids);

        const ranked = pool
            .map((u) => {
                const s = scores.get(String(u._id)) || { score: 0, tier: assignTier(0, {}), weightedReviews: 0, reviewsCount: 0 };
                return {
                    userId: String(u._id),
                    name: u.name,
                    avatar: u.avatar || "",
                    score: Math.round(s.score * 10) / 10,
                    tierId: s.tier.tierId,
                    weightedReviews: s.weightedReviews,
                    reviewsCount: s.reviewsCount,
                };
            })
            .sort((a, b) =>
                b.score - a.score ||
                b.weightedReviews - a.weightedReviews ||
                String(a.name).localeCompare(String(b.name)))
            .map((e, i) => ({ ...e, rank: i + 1 }));

        const northStar = ranked[0] || null;
        const orbiting = ranked.slice(1, 20);

        // Supernova of the Month spotlight: top mentor + their best review quote,
        // BERT-picked (highest sentiment among completed-swap reviews, length guard).
        let spotlight = null;
        if (northStar) {
            let best = await Rating.findOne({
                toUser: northStar.userId,
                tiedToCompletedSwap: true,
                "sentiment.score": { $ne: null },
                review: { $regex: /.{40,}/ },
            }).sort({ "sentiment.score": -1 }).select("review sentiment.score fromUser").populate("fromUser", "name").lean();

            // Fallback: most recent substantive review if no sentiment computed yet.
            if (!best) {
                best = await Rating.findOne({
                    toUser: northStar.userId,
                    review: { $regex: /.{30,}/ },
                }).sort({ createdAt: -1 }).select("review fromUser").populate("fromUser", "name").lean();
            }

            spotlight = {
                ...northStar,
                quote: best ? best.review : "",
                quoteBy: best && best.fromUser ? best.fromUser.name : "",
            };
        }

        // Legends Archive (Quasars) for this city.
        const legends = await Legend.find({ city: new RegExp(`^${escapeRegex(label)}$`, "i") })
            .sort({ archivedAt: -1 }).limit(12)
            .populate("userId", "name avatar").lean();

        res.status(200).json({
            city: label,
            northStar,
            orbiting,
            spotlight,
            legends: legends.map((l) => ({
                userId: l.userId ? String(l.userId._id) : null,
                name: l.userId ? l.userId.name : "A legend",
                avatar: l.userId ? l.userId.avatar : "",
                starName: l.starName,
                seasonId: l.seasonId,
            })),
            count: ranked.length,
        });
    } catch (err) {
        console.error("getObservatory error:", err);
        res.status(500).json({ message: "Server error" });
    }
};
