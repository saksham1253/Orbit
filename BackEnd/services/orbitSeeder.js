/**
 * orbitSeeder.js — demo seeding + time-travel for the Orbit Engine (Mission
 * Control C2 / §5). Shared by the CLI (scripts/seedOrbitDemo.js) and the future
 * admin API, so simulated state is produced ONE way.
 *
 * Design principle (the important bit): we do NOT fabricate state. We REPLAY the
 * real pure-core engines day-by-day with an injected clock, so a seeded "60-day
 * streak" carries the exact milestonesHit + Photons an organically-earned one
 * would. Everything the run creates is recorded in a SeedLedger for EXACT
 * teardown (no model tagging, no orphans, restores the real account's prior
 * orbit). Pure builders are unit-testable without a DB.
 */

const bcrypt = require("bcrypt");
const User = require("../models/user");
const Skill = require("../models/skill");
const Connection = require("../models/Connection");
const Constellation = require("../models/Constellation");
const SeedLedger = require("../models/SeedLedger");
const engine = require("../services/orbitEngine");
const conEngine = require("../services/constellationEngine");
const league = require("../services/leagueService");
const shop = require("../services/cosmeticsCatalog");
const { utcDayStr, isoWeekId } = require("../services/orbitActivity");

const TAG = "orbit-demo";
const DEMO_DIVISION = "star_cluster";                 // "mid-Gold" analog (index 3 of 6)
const DEMO_COSMETICS = ["glow_aurora", "bg_nebula_violet"];
// One bcrypt hash reused for all seeded bot/rival accounts (they never log in).
const BOT_PW_HASH = bcrypt.hashSync("orbit-demo-bot-not-a-login", 8);

// ── pure date helpers (UTC) ─────────────────────────────────────────────────
function dayStrOffset(now, deltaDays) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + deltaDays));
    return d.toISOString().slice(0, 10);
}
function nextDay(dayStr) {
    const [y, m, d] = dayStr.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}
function prevDay(dayStr) {
    const [y, m, d] = dayStr.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

/**
 * buildDemoOrbit — PURE. Replay `streakDays` consecutive days of activity ending
 * at `now`, then layer the current week's freeze/missions/league/cosmetics.
 * Returns the exact `orbit` sub-doc + a summary. No I/O.
 */
function buildDemoOrbit(now, { streakDays = 60, division = DEMO_DIVISION, leagueXp = 220 } = {}) {
    // 1) Streak — faithful engine replay over the last `streakDays` UTC days.
    let s = { current: 0, longest: 0, lastActionDay: null, milestonesHit: [], freezeTokens: 0 };
    let photons = 0;
    for (let i = streakDays - 1; i >= 0; i--) {
        const res = engine.applyAction(s, dayStrOffset(now, -i));
        s = res.streak;
        photons += res.stardust;
    }
    const weekId = isoWeekId(now);

    // 2) Gravity Assist — this week's free token.
    const freeze = engine.grantWeeklyFreeze({ tokens: s.freezeTokens, lastGrantWeek: "" }, weekId).freeze;

    // 3) Missions — this week's real set; leave one near-complete and one claimable.
    const missions = engine.rollMissions({ weekId: "", items: [] }, weekId).missions;
    if (missions.items[0]) missions.items[0].progress = Math.max(0, missions.items[0].target - 1);
    if (missions.items[1]) missions.items[1].progress = missions.items[1].target; // claimable

    // 4) League — placed mid-division with a week of XP already banked.
    const leagueState = {
        divisionId: division,
        groupId: `${division}:${weekId}:0`,
        weekXp: leagueXp,
        weekId,
        lastResult: "held",
        highestDivisionId: division,
        sourceXp: { message: 0 },
    };

    // 5) Cosmetics — two unlocked + equipped.
    const cosmetics = {
        owned: [...DEMO_COSMETICS],
        nameGlow: DEMO_COSMETICS.find((k) => shop.CATALOG.find((c) => c.key === k && c.type === "name_glow")) || null,
        background: DEMO_COSMETICS.find((k) => shop.CATALOG.find((c) => c.key === k && c.type === "background")) || null,
    };

    const orbit = {
        streak: { current: s.current, longest: s.longest, lastActionDay: s.lastActionDay, milestonesHit: s.milestonesHit },
        freeze,
        stardust: Math.round(photons),
        missions,
        league: leagueState,
        cosmetics,
        msgCredit: { day: null, partners: [] },
        prefs: { decayReminders: true },
    };
    const summary = {
        streak: s.current, longest: s.longest, milestonesHit: s.milestonesHit,
        photons: orbit.stardust, division, leagueXp, weekId,
        graduated: s.longest > 59,
    };
    return { orbit, summary };
}

// ── DB seeding ───────────────────────────────────────────────────────────────
function newRunId(now) {
    // Deterministic-ish unique id without Math.random (stable in tests): time + rand-free.
    return `seed_${now.getTime().toString(36)}_${Math.floor(now.getTime() % 100000).toString(36)}`;
}

/**
 * seedDemoAccount — fill `userId` so every tier renders, plus a partner-bot +
 * live Binary Star, ~`rivals` league rivals, mastery skills, and a completed
 * session. Records a SeedLedger for exact teardown. Requires a live DB.
 */
async function seedDemoAccount({ userId, now = new Date(), rivals = 29 } = {}) {
    const user = await User.findById(userId);
    if (!user) throw new Error("target user not found");

    const runId = newRunId(now);
    const refs = [];
    const { orbit, summary } = buildDemoOrbit(now);
    const today = utcDayStr(now);
    const weekId = isoWeekId(now);

    // Snapshot for restore-on-teardown.
    const prevOrbit = user.orbit ? JSON.parse(JSON.stringify(user.orbit)) : null;
    const prevSkillIds = (await Skill.find({ userId }).select("_id").lean()).map((s) => s._id);

    // 1) Apply the demo orbit to the real account.
    user.orbit = orbit;
    await user.save();

    // 2) Partner-bot + a live Binary Star (shared streak seeded via engine replay).
    const bot = await User.create({
        name: "Nova (demo partner)", email: `demo-bot-${runId}@orbit.seed`, password: BOT_PW_HASH,
        bio: "Seeded Binary Star partner.", trustScore: 70,
    });
    refs.push({ model: "User", id: bot._id });

    // Replay ~30 both-days so the shared streak is faithful.
    let pair = { streak: { current: 0, longest: 0, lastBothDay: null, milestonesHit: [] }, lastActionDay: {}, freezeTokens: 0 };
    const members = [String(userId), String(bot._id)];
    for (let i = 29; i >= 0; i--) {
        const day = dayStrOffset(now, -i);
        pair = conEngine.applyPairContribution(pair, members[0], members, day).state;
        pair = conEngine.applyPairContribution(pair, members[1], members, day).state;
    }
    pair.freezeTokens = conEngine.grantWeeklyFreezePair({ tokens: 0, lastGrantWeek: "" }, weekId).freeze.tokens;
    const con = await Constellation.create({
        members: [userId, bot._id].sort(),
        pairKey: conEngine.pairKeyOf(userId, bot._id),
        invitedBy: userId, status: "active", activatedAt: now,
        streak: pair.streak, lastActionDay: pair.lastActionDay,
        freeze: { tokens: pair.freezeTokens, lastGrantWeek: weekId },
    });
    refs.push({ model: "Constellation", id: con._id });

    // 3) League rivals sharing the user's group, XP spread so the user sits mid-pack.
    const groupId = orbit.league.groupId;
    const rivalDocs = Array.from({ length: rivals }, (_, i) => ({
        name: `Rival ${i + 1} (demo)`, email: `demo-rival-${runId}-${i}@orbit.seed`, password: BOT_PW_HASH,
        trustScore: 60,
        cosmic: { score: 50 + ((i * 7) % 45) },
        orbit: { league: { divisionId: DEMO_DIVISION, groupId, weekId, weekXp: 40 + i * 15, highestDivisionId: DEMO_DIVISION } },
    }));
    const insertedRivals = await User.insertMany(rivalDocs);
    for (const r of insertedRivals) refs.push({ model: "User", id: r._id });

    // 4) Mastery — 3 skills at Initiate / Mentor / Master thresholds.
    const masterySkills = [
        { skillOffered: "Guitar",  skillWanted: "Spanish", sessionsTaught: 10 },  // Mentor
        { skillOffered: "Cooking", skillWanted: "Chess",   sessionsTaught: 25 },  // Master
        { skillOffered: "Coding",  skillWanted: "Guitar",  sessionsTaught: 1 },   // Initiate
    ];
    for (const sk of masterySkills) {
        const doc = await Skill.create({ userId, description: "Seeded demo skill", ...sk });
        refs.push({ model: "Skill", id: doc._id });
    }

    // 5) A completed session (Rank-Up + post-session ritual cards ready to test).
    const skillForSwap = await Skill.findOne({ _id: refs.find((r) => r.model === "Skill").id });
    const conn = await Connection.create({
        requester: bot._id, receiver: userId, skill: skillForSwap._id,
        status: "completed", completedAt: now, message: "Seeded completed session.",
    });
    refs.push({ model: "Connection", id: conn._id });

    const ledger = await SeedLedger.create({
        seedRunId: runId, tag: TAG, targetUserId: userId, prevOrbit, prevSkillIds,
        refs, summary: { ...summary, rivals: insertedRivals.length, partnerBotId: String(bot._id) },
    });

    return { seedRunId: runId, ledgerId: String(ledger._id), summary: ledger.summary };
}

/**
 * warp — time-travel a seeded account without waiting real days.
 * op: "advance" | "rewind" | "miss" | "jumpMilestone" | "rollover"
 */
async function warp({ userId, op, value, now = new Date() } = {}) {
    const user = await User.findById(userId);
    if (!user || !user.orbit) throw new Error("user/orbit not found");
    const st = user.orbit.streak || {};
    const MILES = engine.MILESTONES.map((m) => m.days);

    if (op === "advance") {
        const day = st.lastActionDay ? nextDay(st.lastActionDay) : utcDayStr(now);
        const res = engine.applyAction({ ...st, freezeTokens: (user.orbit.freeze && user.orbit.freeze.tokens) || 0 }, day);
        user.orbit.streak = { current: res.streak.current, longest: res.streak.longest, lastActionDay: res.streak.lastActionDay, milestonesHit: res.streak.milestonesHit };
        user.orbit.freeze.tokens = res.streak.freezeTokens;
    } else if (op === "rewind") {
        st.current = Math.max(0, (st.current || 0) - 1);
        if (st.lastActionDay) st.lastActionDay = prevDay(st.lastActionDay);
        user.orbit.streak = st;
    } else if (op === "miss") {
        // Simulate a missed day: last action was 2 days ago (a real next action then
        // either bridges via freeze or resets — graduated users keep their badge).
        st.lastActionDay = dayStrOffset(now, -2);
        user.orbit.streak = st;
    } else if (op === "jumpMilestone") {
        const target = Number(value) || 0;
        st.current = target;
        st.longest = Math.max(st.longest || 0, target);
        st.lastActionDay = utcDayStr(now);
        st.milestonesHit = MILES.filter((d) => d <= target);
        user.orbit.streak = st;
    } else if (op === "rollover") {
        user.markModified("orbit");
        await user.save();
        return runLeagueRolloverForGroup(user.orbit.league && user.orbit.league.groupId, now);
    } else {
        throw new Error(`unknown warp op: ${op}`);
    }

    user.markModified("orbit");
    await user.save();
    const grad = engine.graduationStatus(user.orbit.streak.current, user.orbit.streak.longest);
    return { op, streak: user.orbit.streak.current, longest: user.orbit.streak.longest, phase: grad.phase, badge: grad.badge };
}

/** Run one league rollover over a single group (promote/relegate + re-seed). */
async function runLeagueRolloverForGroup(groupId, now = new Date()) {
    if (!groupId) throw new Error("no groupId to roll over");
    const members = await User.find({ "orbit.league.groupId": groupId }).select("name orbit.league cosmic.score").lean();
    const divisionId = groupId.split(":")[0];
    const rows = members.map((u) => ({
        userId: String(u._id),
        weekXp: (u.orbit.league && u.orbit.league.weekXp) || 0,
        divisionId,
        highestDivisionId: (u.orbit.league && u.orbit.league.highestDivisionId) || divisionId,
    }));
    const outcomes = league.applyRollover(rows, divisionId);
    const newWeek = isoWeekId(now);
    const ops = outcomes.map((o) => ({
        updateOne: {
            filter: { _id: o.userId },
            update: { $set: {
                "orbit.league.divisionId": o.nextDivisionId,
                "orbit.league.groupId": `${o.nextDivisionId}:${newWeek}:0`,
                "orbit.league.weekXp": 0,
                "orbit.league.weekId": newWeek,
                "orbit.league.lastResult": o.result,
                "orbit.league.highestDivisionId": league.higherDivision(
                    (rows.find((r) => r.userId === o.userId) || {}).highestDivisionId || divisionId, o.nextDivisionId),
            } },
        },
    }));
    if (ops.length) await User.bulkWrite(ops, { ordered: false });
    const counts = outcomes.reduce((a, o) => (a[o.result] = (a[o.result] || 0) + 1, a), {});
    return { op: "rollover", groupSize: outcomes.length, ...counts };
}

/**
 * teardown — undo a seed run EXACTLY: delete every created doc and restore the
 * target account's prior orbit. Scope by seedRunId, or the latest run for a user.
 */
async function teardown({ userId, seedRunId } = {}) {
    const ledger = seedRunId
        ? await SeedLedger.findOne({ seedRunId })
        : await SeedLedger.findOne({ targetUserId: userId }).sort({ createdAt: -1 });
    if (!ledger) return { removed: 0, restored: false, reason: "no_seed_run" };

    // Delete created docs, grouped by model.
    const byModel = { User, Skill, Connection, Constellation };
    let removed = 0;
    const grouped = ledger.refs.reduce((a, r) => ((a[r.model] ||= []).push(r.id), a), {});
    for (const [model, ids] of Object.entries(grouped)) {
        if (!byModel[model]) continue;
        const res = await byModel[model].deleteMany({ _id: { $in: ids } });
        removed += res.deletedCount || 0;
    }

    // Restore the real account's orbit.
    let restored = false;
    if (ledger.targetUserId) {
        await User.updateOne({ _id: ledger.targetUserId }, { $set: { orbit: ledger.prevOrbit || {} } });
        restored = true;
    }
    await SeedLedger.deleteOne({ _id: ledger._id });
    return { removed, restored, seedRunId: ledger.seedRunId };
}

module.exports = {
    TAG, DEMO_DIVISION, DEMO_COSMETICS,
    dayStrOffset, nextDay, prevDay,
    buildDemoOrbit,
    seedDemoAccount, warp, runLeagueRolloverForGroup, teardown,
};
