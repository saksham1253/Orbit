const User = require("../models/user");
const Rating = require("../models/rating");
const Connection = require("../models/Connection");
const Legend = require("../models/Legend");
const RankEvent = require("../models/RankEvent");
const { buildLeaderboard, scorePool, mentorCandidates, scopeFilter, norm } = require("../services/leaderboardService");
const { computeCosmicScore } = require("../services/cosmicScore");
const { assignTier, resolveDisplayTier, nameGlowFor, higherTier, TIER_ORDER } = require("../services/cosmicTier");

// Below-Moon "Descent" categories — never eligible for North Star / Supernova awards (v4 §7).
const DESCENT_CATEGORIES = new Set(["stardust", "meteor", "asteroid"]);
const isDescentTier = (tierId) => DESCENT_CATEGORIES.has(String(tierId || "").split("_")[0]);

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
            .select("name avatar location city region country coordinates geo cosmic")
            .lean();
        if (!me) return res.status(404).json({ message: "User not found" });

        // Resolve a location: explicit query → viewer's saved coords → 400.
        let lat = req.query.lat != null ? parseFloat(req.query.lat) : null;
        let lng = req.query.lng != null ? parseFloat(req.query.lng) : null;
        if ((lat == null || Number.isNaN(lat)) && me.coordinates && me.coordinates.lat != null) {
            lat = me.coordinates.lat; lng = me.coordinates.lng;
        }
        // §8.5 — if the viewer has no location and asked for a coordinate scope,
        // DON'T 400. Default the board to Country (works off admin fields / is
        // inclusive) and tell the UI to nudge them to set a city.
        const needsCoords = scope === "neighborhood" || scope === "city";
        const noPos = lat == null || Number.isNaN(lat);
        let effectiveScope = scope;
        let viewerNeedsLocation = false;
        if (needsCoords && noPos && !me.city && !me.location) {
            effectiveScope = "country";
            viewerNeedsLocation = true;
        }

        const payload = await buildLeaderboard({ me, lat, lng, scope: effectiveScope, season });
        return res.status(200).json({ ...payload, requestedScope: scope, viewerNeedsLocation });
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
        const mentor = await User.findById(req.params.id).select("name cosmic city region country").lean();
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
        // Hysteresis: anchor on the user's stored tier so boundaries are sticky (v4 §3).
        const anchorTier = (mentor.cosmic && mentor.cosmic.tierId) || "moon_4";
        const tier = resolveDisplayTier(result.score, anchorTier, { weightedReviews: result.weightedReviews, seasonsPlayed: 0 });

        // v2 §1.2 — peakTierId is monotonic: max(stored, current). v4 — persist the
        // resolved tier + a pending rank-moment when the tier actually changed.
        const storedPeak = (mentor.cosmic && mentor.cosmic.peakTierId) || "moon_4";
        const peakId = higherTier(storedPeak, tier.tierId);
        const glow = nameGlowFor(tier.tierId);
        const tierChanged = tier.tierId !== anchorTier;
        if (tierChanged || peakId !== storedPeak || (mentor.cosmic && mentor.cosmic.nameGlowTier) !== glow) {
            const set = { "cosmic.peakTierId": peakId, "cosmic.nameGlowTier": glow, "cosmic.tierId": tier.tierId };
            if (tierChanged) {
                set["cosmic.lastTierChangeAt"] = new Date();
                set["cosmic.lastTierDirection"] = tier.direction;
                set["cosmic.pendingMomentTierId"] = tier.tierId;
                set["cosmic.pendingMomentDirection"] = tier.direction;

                // Admin observability: append one RankEvent per real tier change
                // (best-effort, never blocks the response). Idempotent in practice
                // because the new tier is persisted below, so a subsequent read
                // sees anchorTier === tier.tierId → tierChanged false.
                if (tier.direction === "up" || tier.direction === "down") {
                    RankEvent.create({
                        userId: mentor._id,
                        scope: "global",
                        fromTierId: anchorTier,
                        toTierId: tier.tierId,
                        direction: tier.direction,
                        scoreBefore: (mentor.cosmic && mentor.cosmic.score) != null ? mentor.cosmic.score : null,
                        scoreAfter: Math.round(result.score * 10) / 10,
                        trigger: "score",
                        seasonId: (mentor.cosmic && mentor.cosmic.seasonId) || "",
                        city: mentor.city || "",
                    }).catch(() => {});
                }
            }
            // Persist the freshly resolved score too, so the next RankEvent's
            // scoreBefore reflects reality (additive; display already uses the
            // live computed score).
            set["cosmic.score"] = Math.round(result.score * 10) / 10;
            User.updateOne({ _id: mentor._id }, { $set: set }).catch(() => {});
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
            direction: tier.direction,            // v4: 'up' | 'down' | null
            pendingMomentTierId: tierChanged ? tier.tierId : (mentor.cosmic && mentor.cosmic.pendingMomentTierId) || null,
            pendingMomentDirection: tierChanged ? tier.direction : (mentor.cosmic && mentor.cosmic.pendingMomentDirection) || null,
            anchorTierId: anchorTier,
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
        const me = await User.findById(req.user.id)
            .select("name location city region country coordinates geo cosmic").lean();
        if (!me) return res.status(404).json({ message: "User not found" });

        // §8.5 — unify the Observatory candidate set with the leaderboard/Browse
        // set (mentors who offer a skill), then scope-filter. When a :city param
        // is given, narrow the same candidates to that city/location text; else
        // use the viewer's City scope (which auto-widens by radius).
        const candidates = await mentorCandidates(me._id);
        const lat = me.coordinates && me.coordinates.lat != null ? me.coordinates.lat : null;
        const lng = me.coordinates && me.coordinates.lng != null ? me.coordinates.lng : null;

        let pool, label;
        if (cityParam) {
            const cp = norm(cityParam);
            pool = candidates.filter((u) => norm(u.city) === cp || norm(u.location) === cp);
            label = cityParam;
        } else {
            const filtered = scopeFilter(candidates, { scope: "city", me, lat, lng });
            pool = filtered.pool;
            label = filtered.label;
        }

        const ids = pool.map((u) => u._id);
        const scores = await scorePool(ids);

        const SEASON_BASELINE = 50; // warm-start floor = each user's season start

        const ranked = pool
            .map((u) => {
                const s = scores.get(String(u._id)) || { score: SEASON_BASELINE, tier: assignTier(SEASON_BASELINE, {}), weightedReviews: 0, reviewsCount: 0 };
                // Climb this season = live score − the season-start baseline. Prefer a
                // persisted baseline if present; otherwise the warm-start floor.
                const baseline = (u.cosmic && typeof u.cosmic.seasonStartScore === "number")
                    ? u.cosmic.seasonStartScore : SEASON_BASELINE;
                // Net tier-divisions climbed this season (Supernova tiebreak, §2.4).
                const startTierId = assignTier(baseline, {}).tierId;
                const deltaDivisions = (TIER_ORDER.indexOf(s.tier.tierId) - TIER_ORDER.indexOf(startTierId)) || 0;
                return {
                    userId: String(u._id),
                    name: u.name,
                    avatar: u.avatar || "",
                    score: Math.round(s.score * 10) / 10,
                    tierId: s.tier.tierId,
                    climb: Math.round((s.score - baseline) * 10) / 10,
                    deltaDivisions,
                    weightedReviews: s.weightedReviews,
                    reviewsCount: s.reviewsCount,
                };
            })
            .sort((a, b) =>
                b.score - a.score ||
                b.weightedReviews - a.weightedReviews ||
                String(a.name).localeCompare(String(b.name)) ||
                String(a.userId).localeCompare(String(b.userId)))
            .map((e, i) => ({ ...e, rank: i + 1 }));

        const northStar = ranked[0] || null;
        // Provisional (§2.1): no real climbs yet (season young) OR the top two are
        // tied on score (so #1 is decided only by a tiebreaker).
        const tiedTop = ranked.length >= 2 && Math.abs(ranked[0].score - ranked[1].score) < 0.05;
        const provisional = !!northStar && (ranked.every((r) => r.climb <= 0) || tiedTop);
        const orbiting = ranked.slice(1, 20);

        // "You are here" (§2.3): the viewer's own standing within this scope, so the
        // UI can always mark where they are (highlighted node or docked chip).
        const meId = String(req.user.id);
        const meEntry = ranked.find((r) => r.userId === meId) || null;
        const you = meEntry ? {
            userId: meEntry.userId,
            rank: meEntry.rank,
            of: ranked.length,
            tierId: meEntry.tierId,
            score: meEntry.score,
            isNorthStar: meEntry.rank === 1,
            inOrbit: meEntry.rank >= 2 && meEntry.rank <= 20, // within the rendered nodes
        } : null;

        // Supernova of the Month = the BIGGEST REAL CLIMBER this season (v3 §3).
        // Only crown someone with a strictly positive climb; otherwise empty state.
        // NEVER relabel their tier — the award is separate from the tier.
        let spotlight = null;
        // Eligible climbers: strictly positive climb AND not a Descent-tier mentor (v4 §7).
        // Tiebreak equal climbs by net tier-divisions climbed (§2.4).
        const topClimber = ranked
            .filter((r) => r.climb > 0 && !isDescentTier(r.tierId))
            .sort((a, b) => b.climb - a.climb || b.deltaDivisions - a.deltaDivisions)[0] || null;
        if (topClimber) {
            let best = await Rating.findOne({
                toUser: topClimber.userId,
                tiedToCompletedSwap: true,
                "sentiment.score": { $ne: null },
                review: { $regex: /.{40,}/ },
            }).sort({ "sentiment.score": -1 }).select("review sentiment.score fromUser").populate("fromUser", "name").lean();

            if (!best) {
                best = await Rating.findOne({
                    toUser: topClimber.userId,
                    review: { $regex: /.{30,}/ },
                }).sort({ createdAt: -1 }).select("review fromUser").populate("fromUser", "name").lean();
            }

            spotlight = {
                userId: topClimber.userId,
                name: topClimber.name,
                avatar: topClimber.avatar,
                tierId: topClimber.tierId,       // their REAL tier (not "Supernova")
                score: topClimber.score,
                climb: topClimber.climb,         // award metric: "+X.X points this season"
                deltaScore: topClimber.climb,    // §2.4 contract alias
                deltaDivisions: topClimber.deltaDivisions, // §2.4 net divisions climbed
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
            provisional,        // true when no real climbs yet, or top two tied on score
            you,                // viewer's own standing in this scope (§2.3), or null
            orbiting,
            spotlight,          // null unless a real positive climber exists
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
