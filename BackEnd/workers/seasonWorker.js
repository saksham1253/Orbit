/**
 * seasonWorker.js — monthly season lifecycle + rollover (spec §15.1).
 *
 * In-process scheduled job (mirrors archiveWorker). At each tick it:
 *   1. Ensures an "active" Season doc exists for the current month.
 *   2. If any PRIOR active season has now ended, rolls it over IDEMPOTENTLY:
 *        - snapshot each city's #1 mentor → Legend (Quasar) with a star name
 *        - reset cosmic.score / activeDaysThisSeason for that season's users
 *        - RETAIN cosmic.peakTierId (lifetime best) and tierId (absolute)
 *        - mark the season archived
 *
 * Idempotency: the Legend (city, seasonId) unique index + the season status
 * flag mean a double-run cannot create duplicates or double-reset.
 *
 * Additive & non-destructive: only writes cosmic.{score,seasonId,
 * activeDaysThisSeason} and inserts Legend/Season docs.
 */

const User = require("../models/user");
const Season = require("../models/Season");
const Legend = require("../models/Legend");
const { scorePool } = require("../services/leaderboardService");
const { assignTier } = require("../services/cosmicTier");
const { seasonIdFor, seasonBounds } = require("../services/seasonService");

const INTERVAL_MS = Number(process.env.COSMIC_SEASON_INTERVAL_MS) || 6 * 60 * 60 * 1000; // 6h

function starNameFor(name) {
    const first = String(name || "").trim().split(/\s+/)[0] || "Nova";
    return `The ${first} Star`;
}

/** Ensure the current month has an active Season doc. */
async function ensureActiveSeason(now = new Date()) {
    const seasonId = seasonIdFor(now);
    const existing = await Season.findOne({ seasonId });
    if (existing) return existing;
    const { startsAt, endsAt } = seasonBounds(now);
    try {
        return await Season.create({ seasonId, startsAt, endsAt, status: "active" });
    } catch (_) {
        // Unique index race → someone else created it; fetch and return.
        return Season.findOne({ seasonId });
    }
}

/**
 * Roll over a single ended season. Idempotent: re-running is a no-op once the
 * season is archived. Returns a summary.
 */
async function rolloverSeason(season) {
    const summary = { seasonId: season.seasonId, legends: 0, reset: 0 };

    // Users who competed in this season.
    const users = await User.find({ "cosmic.seasonId": season.seasonId })
        .select("name city cosmic").lean();

    // Group by city, find each city's #1 by on-read score.
    const byCity = new Map();
    for (const u of users) {
        const city = (u.city || "").trim();
        if (!city) continue;
        if (!byCity.has(city)) byCity.set(city, []);
        byCity.get(city).push(u);
    }

    for (const [city, members] of byCity) {
        const ids = members.map((m) => m._id);
        const scores = await scorePool(ids);
        let champ = null, champScore = -1;
        for (const m of members) {
            const s = scores.get(String(m._id));
            const sc = s ? s.score : 0;
            if (sc > champScore) { champScore = sc; champ = m; }
        }
        if (!champ) continue;

        // Snapshot the champion as a Quasar legend (idempotent via unique index).
        try {
            await Legend.create({
                userId: champ._id,
                city,
                seasonId: season.seasonId,
                starName: starNameFor(champ.name),
                archivedAt: new Date(),
            });
            summary.legends++;
            // Retire the champion to Quasar + retain peak.
            await User.updateOne(
                { _id: champ._id },
                { $set: { "cosmic.peakTierId": "quasar" } }
            );
        } catch (err) {
            if (err.code !== 11000) console.error("[SeasonWorker] legend insert:", err.message);
            // 11000 = already archived this (city, season) → idempotent skip.
        }
    }

    // Reset competitive fields for next season; KEEP peakTierId + tierId.
    const nextId = seasonIdFor(new Date());
    const r = await User.updateMany(
        { "cosmic.seasonId": season.seasonId },
        { $set: { "cosmic.score": 0, "cosmic.activeDaysThisSeason": 0, "cosmic.seasonId": nextId } }
    );
    summary.reset = r.modifiedCount || 0;

    await Season.updateOne({ _id: season._id }, { $set: { status: "archived" } });
    return summary;
}

async function runSeasonJob() {
    try {
        const now = new Date();
        await ensureActiveSeason(now);

        // Any active season whose window has ended → roll over.
        const ended = await Season.find({ status: "active", endsAt: { $lte: now } });
        for (const s of ended) {
            // Don't archive the *current* month's season.
            if (s.seasonId === seasonIdFor(now)) continue;
            const summary = await rolloverSeason(s);
            console.log(`[SeasonWorker] rolled over ${summary.seasonId}: ${summary.legends} legend(s), reset ${summary.reset} user(s).`);
        }
    } catch (err) {
        console.error("[SeasonWorker] error:", err);
    }
    setTimeout(runSeasonJob, INTERVAL_MS);
}

/** Call once from server.js after DB connects. */
function startSeasonWorker() {
    console.log(`[SeasonWorker] scheduled every ${(INTERVAL_MS / 3600000).toFixed(0)}h.`);
    setTimeout(runSeasonJob, 60 * 1000); // first run a minute after boot
}

module.exports = { startSeasonWorker, runSeasonJob, rolloverSeason, ensureActiveSeason };
