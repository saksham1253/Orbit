/**
 * leagueWorker.js — Weekly League rollover (Orbit Engine, Tier 2b).
 *
 * Mirrors seasonWorker/archiveWorker: an in-process scheduled job (no external
 * cron). At each run it processes every cohort whose league week has ENDED
 * (orbit.league.weekId is in the past):
 *   1. group members by their stored groupId → rank by weekly XP;
 *   2. promote the top / relegate the bottom (edge divisions clamp);
 *   3. re-seed NEW groups per division by CosmicScore similarity (winnable
 *      matchmaking), reset weekXp to 0, stamp the current week;
 *   4. notify promoted/relegated users (best-effort).
 *
 * Idempotent: once a user's weekId is advanced to the current week they're no
 * longer "stale", so a re-run is a no-op. Never throws out of the tick.
 */

const User = require("../models/user");
const league = require("../services/leagueService");
const { isoWeekId } = require("../services/orbitActivity");
const { createNotification } = require("../services/notify");

const INTERVAL_MS = 6 * 60 * 60 * 1000; // check every 6h; the week-guard makes it a weekly effect
const MAX_NOTIFY  = 1000;

async function runLeagueRollover(io) {
    const currentWeek = isoWeekId(new Date());
    let promoted = 0, relegated = 0, regrouped = 0;

    try {
        // Cohorts whose week has ended (has a weekId, and it isn't the current one).
        const stale = await User.find({ "orbit.league.weekId": { $exists: true, $nin: [currentWeek, ""] } })
            .select("name orbit.league cosmic.score")
            .lean();
        if (!stale.length) { scheduleNext(io); return; }

        // 1) Group the ended cohorts by their stored groupId.
        const groups = new Map();
        for (const u of stale) {
            const gid = (u.orbit.league && u.orbit.league.groupId) || `${u.orbit.league.divisionId}:old:0`;
            if (!groups.has(gid)) groups.set(gid, []);
            groups.get(gid).push(u);
        }

        // 2) Promotion/relegation per group → per-user outcome.
        const outcome = new Map(); // userId → { nextDivisionId, result, cosmicScore, oldHighest, name }
        for (const [gid, members] of groups) {
            const divisionId = gid.split(":")[0] || members[0].orbit.league.divisionId;
            const rows = members.map((u) => ({
                userId: String(u._id),
                weekXp: (u.orbit.league && u.orbit.league.weekXp) || 0,
                divisionId,
                highestDivisionId: (u.orbit.league && u.orbit.league.highestDivisionId) || divisionId,
            }));
            for (const o of league.applyRollover(rows, divisionId)) {
                const src = members.find((m) => String(m._id) === o.userId);
                outcome.set(o.userId, {
                    nextDivisionId: o.nextDivisionId,
                    result: o.result,
                    cosmicScore: (src.cosmic && src.cosmic.score) || 0,
                    oldHighest: (src.orbit.league && src.orbit.league.highestDivisionId) || o.nextDivisionId,
                    name: src.name,
                });
                if (o.result === "promoted") promoted++;
                else if (o.result === "relegated") relegated++;
            }
        }

        // 3) Re-seed groups per NEW division, sorted by CosmicScore desc.
        const byDivision = new Map();
        for (const [userId, o] of outcome) {
            if (!byDivision.has(o.nextDivisionId)) byDivision.set(o.nextDivisionId, []);
            byDivision.get(o.nextDivisionId).push({ userId, cosmicScore: o.cosmicScore });
        }

        const ops = [];
        for (const [divisionId, arr] of byDivision) {
            arr.sort((a, b) => b.cosmicScore - a.cosmicScore || String(a.userId).localeCompare(String(b.userId)));
            const assignments = league.rebuildGroups(arr, divisionId, currentWeek);
            for (const a of assignments) {
                const o = outcome.get(a.userId);
                ops.push({
                    updateOne: {
                        filter: { _id: a.userId },
                        update: {
                            $set: {
                                "orbit.league.divisionId": divisionId,
                                "orbit.league.groupId": a.groupId,
                                "orbit.league.weekXp": 0,
                                "orbit.league.weekId": currentWeek,
                                "orbit.league.lastResult": o.result,
                                "orbit.league.highestDivisionId": league.higherDivision(o.oldHighest, divisionId),
                            },
                        },
                    },
                });
            }
        }
        if (ops.length) {
            const r = await User.bulkWrite(ops, { ordered: false });
            regrouped = r.modifiedCount || ops.length;
        }

        // 4) Notify movers (best-effort, capped).
        let notified = 0;
        for (const [userId, o] of outcome) {
            if (notified >= MAX_NOTIFY) break;
            if (o.result === "held") continue;
            const meta = league.divisionMeta(o.nextDivisionId);
            const up = o.result === "promoted";
            createNotification(io, userId, {
                type: up ? "league_promoted" : "league_relegated",
                title: up ? `⏫ Promoted to ${meta.name}!` : `⏬ Relegated to ${meta.name}`,
                body: up
                    ? `You finished top of your league — welcome to ${meta.name}. New week, new rivals.`
                    : `You slipped to ${meta.name} this week. Climb back with more Orbit XP.`,
                data: { link: "/orbit", divisionId: o.nextDivisionId, result: o.result },
            }).catch(() => {});
            notified++;
        }

        console.log(`[LeagueWorker] Rollover → ${promoted} promoted, ${relegated} relegated, ${regrouped} regrouped into ${currentWeek}.`);
    } catch (err) {
        console.error("[LeagueWorker] error:", err.message);
    }
    scheduleNext(io);
}

function scheduleNext(io) {
    setTimeout(() => runLeagueRollover(io), INTERVAL_MS);
}

/** Call once from server.js after DB connects. First check ~2 min after boot. */
function startLeagueWorker(io) {
    console.log(`[LeagueWorker] scheduled every ${(INTERVAL_MS / 3600000).toFixed(0)}h (weekly effect via week-guard).`);
    setTimeout(() => runLeagueRollover(io), 2 * 60 * 1000);
}

module.exports = { startLeagueWorker, runLeagueRollover };
