/**
 * leagueController.js — Weekly League standings API (Orbit Engine, Tier 2b).
 * GET /api/orbit/league returns the viewer's division, their group's live
 * standings (ranked by this week's XP), promote/relegate zones, and a countdown
 * to the Monday-UTC reset. Read self-heals the weekly XP reset on the viewer.
 */

const User = require("../models/user");
const league = require("../services/leagueService");
const { isoWeekId, rollForward } = require("../services/orbitActivity");

// Ms until the next Monday 00:00 UTC (when the league week rolls over).
function nextMondayUTC(now = new Date()) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
    const dow = d.getUTCDay();                 // 0=Sun … 1=Mon
    const daysUntilMon = ((8 - dow) % 7) || 7; // always the NEXT Monday
    d.setUTCDate(d.getUTCDate() + daysUntilMon);
    return d.toISOString();
}

// GET /api/orbit/league
exports.getMyLeague = async (req, res) => {
    try {
        const meId = req.user.id;
        const me = await User.findById(meId).select("orbit name avatar").lean();
        if (!me) return res.status(404).json({ message: "User not found" });

        // Self-heal the weekly reset on read, then persist if it changed.
        const { orbit, changed } = rollForward(me.orbit);
        if (changed) User.updateOne({ _id: meId }, { $set: { orbit } }).catch(() => {});

        const weekId = isoWeekId();
        const L = orbit.league;
        const divMeta = league.divisionMeta(L.divisionId);

        // The viewer's group pool — everyone sharing this groupId this week.
        // Fall back to same-division/same-week members if the group is unset.
        const groupId = L.groupId || `${L.divisionId}:${weekId}:0`;
        const pool = await User.find({ "orbit.league.groupId": groupId })
            .select("name avatar orbit.league").lean();

        // Always include the viewer even if the group index just changed on read.
        const members = pool.map((u) => ({
            userId: String(u._id),
            name: u.name,
            avatar: u.avatar || "",
            weekXp: (u.orbit && u.orbit.league && u.orbit.league.weekXp) || 0,
            divisionId: (u.orbit && u.orbit.league && u.orbit.league.divisionId) || L.divisionId,
            highestDivisionId: (u.orbit && u.orbit.league && u.orbit.league.highestDivisionId) || L.divisionId,
            isMe: String(u._id) === String(meId),
        }));
        if (!members.some((m) => m.isMe)) {
            members.push({
                userId: String(meId), name: me.name, avatar: me.avatar || "",
                weekXp: L.weekXp, divisionId: L.divisionId, highestDivisionId: L.highestDivisionId, isMe: true,
            });
        }

        const ranked = league.standings(members, L.divisionId);
        const you = ranked.find((m) => m.isMe) || null;

        return res.status(200).json({
            division: { id: L.divisionId, name: divMeta.name, color: divMeta.color, index: league.divisionIndex(L.divisionId) },
            ladder: league.DIVISIONS,
            weekId,
            weekXp: L.weekXp,
            lastResult: L.lastResult || "",
            promoteCount: league.PROMOTE_COUNT,
            relegateCount: league.RELEGATE_COUNT,
            groupSize: ranked.length,
            you: you ? { rank: you.rank, zone: you.zone, weekXp: you.weekXp } : null,
            standings: ranked.map((m) => ({
                userId: m.userId, name: m.name, avatar: m.avatar,
                weekXp: m.weekXp, rank: m.rank, zone: m.zone, isMe: !!m.isMe,
            })),
            resetsAtUTC: nextMondayUTC(),
            xpTable: league.XP,
        });
    } catch (err) {
        console.error("getMyLeague error:", err);
        res.status(500).json({ message: "Server error" });
    }
};
