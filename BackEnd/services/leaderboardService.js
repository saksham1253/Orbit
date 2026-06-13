/**
 * leaderboardService.js — geographic scoping + on-read CosmicScore ranking.
 *
 * Tier/division come from the ABSOLUTE CosmicScore (everyone can climb);
 * leaderboard RANK is RELATIVE within the resolved geographic pool (local and
 * winnable) — spec §6.7, §11.
 *
 * On-read compute: until the recompute worker (Phase 9/10) is the source of
 * truth, scores are computed live from ratings/connections for the (capped,
 * cached) pool so the board is populated immediately. Results are cached per
 * (scope, centroid bucket, season) for a few minutes to respect the M0
 * connection cap (spec §11.3).
 */

const User       = require("../models/user");
const Rating     = require("../models/rating");
const Connection = require("../models/Connection");
const { computeCosmicScore } = require("./cosmicScore");
const { assignTier } = require("./cosmicTier");

// ── Adaptive radius config (spec §11.2) ────────────────────────────────────
const MIN_POOL = 15;
const RADIUS_STEPS_KM = [10, 25, 50, 100];
const NEIGHBORHOOD_KM = 10;
const REGION_APPROX_KM = 250;   // used when admin region field is absent
const CACHE_TTL_MS = 3 * 60 * 1000;
const MAX_POOL = 200;           // hard cap so on-read compute stays cheap

// Tiny in-process cache (single Render instance). Keyed by scope+bucket+season.
const _cache = new Map();
function cacheGet(key) {
    const hit = _cache.get(key);
    if (hit && Date.now() - hit.t < CACHE_TTL_MS) return hit.v;
    if (hit) _cache.delete(key);
    return null;
}
function cacheSet(key, v) { _cache.set(key, { t: Date.now(), v }); }

// Haversine (km) — mirrors the proven approach already used in geoController.
function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function userLatLng(u) {
    // Prefer legacy coordinates {lat,lng}; fall back to GeoJSON geo.point [lng,lat].
    if (u.coordinates && u.coordinates.lat != null && u.coordinates.lng != null) {
        return { lat: u.coordinates.lat, lng: u.coordinates.lng };
    }
    const c = u.geo && u.geo.point && u.geo.point.coordinates;
    if (Array.isArray(c) && c.length === 2) return { lat: c[1], lng: c[0] };
    return null;
}

/**
 * Mentors within `maxKm` of (lat,lng). Uses the indexed 2dsphere $geoNear when
 * geo.point data exists; falls back to an in-JS haversine scan over legacy
 * coordinates so the board works even before the geo backfill has run.
 */
async function mentorsWithin(lat, lng, maxKm, excludeId) {
    // Primary: indexed geo query (scales on M0; only returns backfilled docs).
    try {
        const near = await User.aggregate([
            {
                $geoNear: {
                    near: { type: "Point", coordinates: [lng, lat] },
                    distanceField: "distanceMeters",
                    maxDistance: maxKm * 1000,
                    spherical: true,
                    query: { _id: { $ne: excludeId } },
                },
            },
            { $limit: MAX_POOL },
        ]);
        if (near.length >= MIN_POOL) {
            return near.map((u) => ({ ...u, distanceKm: u.distanceMeters / 1000 }));
        }
    } catch (_) {
        // 2dsphere may be unavailable on a fresh DB — fall through to haversine.
    }

    // Fallback: scan users with any coordinates, filter by haversine.
    const candidates = await User.find({
        _id: { $ne: excludeId },
        $or: [{ "coordinates.lat": { $ne: null } }, { "geo.point.coordinates.0": { $exists: true } }],
    })
        .select("name avatar city region country coordinates geo cosmic trustScore averageRating sentimentScore")
        .limit(2000)
        .lean();

    return candidates
        .map((u) => {
            const ll = userLatLng(u);
            if (!ll) return null;
            return { ...u, distanceKm: haversineKm(lat, lng, ll.lat, ll.lng) };
        })
        .filter((u) => u && u.distanceKm <= maxKm)
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .slice(0, MAX_POOL);
}

/**
 * Resolve the mentor pool + an honest label for the requested scope (§11.2).
 * @returns {{ pool:Array, label:string, usedFallback:boolean }}
 */
async function resolvePool({ lat, lng, scope, me }) {
    const cityName = (me && me.city) || "your area";

    if (scope === "neighborhood") {
        const pool = await mentorsWithin(lat, lng, NEIGHBORHOOD_KM, me._id);
        return { pool, label: `within ${NEIGHBORHOOD_KM} km of ${cityName}`, usedFallback: false };
    }

    if (scope === "region") {
        if (me && me.region) {
            const pool = await User.find({ _id: { $ne: me._id }, region: me.region })
                .select("name avatar city region country cosmic trustScore averageRating sentimentScore")
                .limit(MAX_POOL).lean();
            if (pool.length >= 1) return { pool, label: me.region, usedFallback: false };
        }
        const pool = await mentorsWithin(lat, lng, REGION_APPROX_KM, me._id);
        return { pool, label: `within ${REGION_APPROX_KM} km`, usedFallback: true };
    }

    if (scope === "country") {
        if (me && me.country) {
            const pool = await User.find({ _id: { $ne: me._id }, country: me.country })
                .select("name avatar city region country cosmic trustScore averageRating sentimentScore")
                .limit(MAX_POOL).lean();
            return { pool, label: me.country, usedFallback: false };
        }
        const pool = await mentorsWithin(lat, lng, 100000, me._id); // effectively unbounded
        return { pool, label: "your country", usedFallback: true };
    }

    // Default: CITY — adaptive radius (spec §11.2).
    for (const r of RADIUS_STEPS_KM) {
        const pool = await mentorsWithin(lat, lng, r, me._id);
        if (pool.length >= MIN_POOL) {
            return { pool, label: `within ${r} km of ${cityName}`, usedFallback: r !== RADIUS_STEPS_KM[0] };
        }
    }
    // Still sparse → widen to region, then country.
    if (me && me.region) {
        const pool = await User.find({ _id: { $ne: me._id }, region: me.region })
            .select("name avatar city region country cosmic trustScore averageRating sentimentScore")
            .limit(MAX_POOL).lean();
        if (pool.length >= MIN_POOL) return { pool, label: me.region, usedFallback: true };
    }
    // Last resort: widest distance pool we found (100 km).
    const pool = await mentorsWithin(lat, lng, RADIUS_STEPS_KM[RADIUS_STEPS_KM.length - 1], me._id);
    return { pool, label: `within ${RADIUS_STEPS_KM[RADIUS_STEPS_KM.length - 1]} km of ${cityName}`, usedFallback: true };
}

/**
 * On-read scoring for a pool of mentors. Batch-loads ratings + completed
 * connections once, then computes each mentor's CosmicScore + tier.
 * @returns {Map<string, { score, tier, weightedReviews, reviewsCount }>}
 */
async function scorePool(mentorIds) {
    if (mentorIds.length === 0) return new Map();
    const now = Date.now();

    // Ratings received by anyone in the pool.
    const ratings = await Rating.find({ toUser: { $in: mentorIds } })
        .select("toUser fromUser score sentiment.score tiedToCompletedSwap createdAt")
        .lean();

    // Group ratings per mentor; track per-reviewer counts for the reviewer cap.
    const byMentor = new Map();
    for (const id of mentorIds) byMentor.set(String(id), { rows: [], reviewerCounts: new Map() });
    for (const r of ratings) {
        const key = String(r.toUser);
        const bucket = byMentor.get(key);
        if (!bucket) continue;
        const rk = String(r.fromUser);
        bucket.reviewerCounts.set(rk, (bucket.reviewerCounts.get(rk) || 0) + 1);
        bucket.rows.push(r);
    }

    // Completed swaps per mentor (counts either endpoint of a completed swap).
    const completed = await Connection.find({
        status: "completed",
        $or: [{ requester: { $in: mentorIds } }, { receiver: { $in: mentorIds } }],
    }).select("requester receiver").lean();
    const swapCount = new Map();
    for (const c of completed) {
        for (const side of [c.requester, c.receiver]) {
            const k = String(side);
            if (byMentor.has(k)) swapCount.set(k, (swapCount.get(k) || 0) + 1);
        }
    }

    const out = new Map();
    for (const [key, bucket] of byMentor) {
        const reviews = bucket.rows.map((r) => ({
            rating: r.score,
            sentiment: r.sentiment && r.sentiment.score != null ? r.sentiment.score : null,
            ageDays: (now - new Date(r.createdAt).getTime()) / 86400000,
            reviewsFromThisReviewer: bucket.reviewerCounts.get(String(r.fromUser)) || 1,
            tiedToCompletedSwap: !!r.tiedToCompletedSwap,
        }));

        const result = computeCosmicScore({
            reviews,
            completedSwaps: swapCount.get(key) || 0,
            activeDaysThisSeason: 0,
            sentimentEnabled: process.env.COSMIC_SENTIMENT_ENABLED !== "false",
        });
        const tier = assignTier(result.score, { weightedReviews: result.weightedReviews, seasonsPlayed: 0 });

        out.set(key, {
            score: result.score,
            tier,
            weightedReviews: result.weightedReviews,
            reviewsCount: bucket.rows.length,
        });
    }
    return out;
}

// Tie-break (spec §18): score → weighted reviews → completed swaps → name.
function rankEntries(entries) {
    return entries
        .sort((a, b) =>
            b.score - a.score ||
            b.weightedReviews - a.weightedReviews ||
            b.reviewsCount - a.reviewsCount ||
            String(a.name).localeCompare(String(b.name))
        )
        .map((e, i) => ({ ...e, rank: i + 1 }));
}

/**
 * Build the leaderboard payload for the API (spec §13).
 * @param {object} args { me (User doc), lat, lng, scope, season }
 */
async function buildLeaderboard({ me, lat, lng, scope = "city", season = "" }) {
    const bucket = `${Math.round(lat * 50)}_${Math.round(lng * 50)}`; // ~2km centroid bucket
    const cacheKey = `${scope}:${bucket}:${season}:${String(me._id)}`;
    const cached = cacheGet(cacheKey);
    if (cached) return cached;

    const { pool, label, usedFallback } = await resolvePool({ lat, lng, scope, me });

    const mentorIds = pool.map((u) => u._id);
    // Ensure the viewer is scored too (so "you" is accurate even if outside pool).
    const idsForScoring = [...mentorIds, me._id];
    const scores = await scorePool(idsForScoring);

    const entries = rankEntries(pool.map((u) => {
        const s = scores.get(String(u._id)) || { score: 0, tier: assignTier(0, {}), weightedReviews: 0, reviewsCount: 0 };
        return {
            userId: String(u._id),
            name: u.name,
            avatar: u.avatar || "",
            city: u.city || "",
            score: Math.round(s.score * 10) / 10,
            tierId: s.tier.tierId,
            title: (u.cosmic && u.cosmic.currentTitle) || "",
            flair: (u.cosmic && u.cosmic.flair) || [],
            badge: s.tier.tierId,
            weightedReviews: s.weightedReviews,
            reviewsCount: s.reviewsCount,
        };
    }));

    // "you" block — find the viewer's own rank within this scope.
    const meScore = scores.get(String(me._id)) || { score: 0, tier: assignTier(0, {}) };
    const youRankIdx = entries.findIndex((e) => e.userId === String(me._id));
    const you = {
        rank: youRankIdx >= 0 ? entries[youRankIdx].rank : null,
        tierId: meScore.tier.tierId,
        score: Math.round(meScore.score * 10) / 10,
        progressToNext: meScore.tier.progressToNext,
    };

    const payload = {
        scope,
        label,
        seasonId: season || null,
        you,
        entries: entries.map(({ weightedReviews, reviewsCount, ...rest }) => rest),
        usedFallback,
    };
    cacheSet(cacheKey, payload);
    return payload;
}

module.exports = {
    buildLeaderboard,
    // exported for tests / reuse
    resolvePool, scorePool, rankEntries, mentorsWithin, haversineKm,
    MIN_POOL, RADIUS_STEPS_KM,
};
