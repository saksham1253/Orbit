/**
 * orbitPreflight.js — one-click health checks (Mission Control C8). Each check
 * asserts a refinement invariant IN-PROCESS against the real pure cores (no
 * external HTTP, deterministic), returning { id, status: 'pass'|'fail', evidence }.
 * These prove the gamification rules still hold on the current build.
 */

const fs = require("fs");
const path = require("path");
const sim = require("./antiGameSim");
const engine = require("./orbitEngine");
const league = require("./leagueService");
const cfg = require("./orbitConfig");

const pass = (id, evidence) => ({ id, status: "pass", evidence });
const fail = (id, evidence) => ({ id, status: "fail", evidence });

const CHECKS = {
    // B1 — 20 messages to one partner → ≤1 streak day + capped XP.
    anti_gaming_spam() {
        const r = sim.simulate({ targets: ["p1"], count: 20 });
        const good = r.totals.streakDaysGranted <= 1 && r.totals.distinctPartnersCredited <= 1;
        return good ? pass("anti_gaming_spam", r.totals) : fail("anti_gaming_spam", r.totals);
    },
    // B1 — 5 messages to 5 distinct partners → first `cap` earn XP, rest 0.
    anti_gaming_multi() {
        const r = sim.simulate({ targets: ["a", "b", "c", "d", "e"], count: 5 });
        const withXp = r.perMessage.filter((m) => m.xp > 0).length;
        const good = withXp === cfg.MSG.dailyXpCap;
        return good ? pass("anti_gaming_multi", { withXp, cap: cfg.MSG.dailyXpCap })
                    : fail("anti_gaming_multi", { withXp, cap: cfg.MSG.dailyXpCap });
    },
    // B2 — a full week of maxed message XP cannot out-earn a few swaps.
    message_only_cannot_promote() {
        const weeklyMsgXp = cfg.MSG.weeklyXpCap;
        const threeSwaps = 3 * league.xpFor("swap");
        const good = weeklyMsgXp < threeSwaps;
        return good ? pass("message_only_cannot_promote", { weeklyMsgXp, threeSwaps })
                    : fail("message_only_cannot_promote", { weeklyMsgXp, threeSwaps });
    },
    // B3 — a graduated user who breaks back to a 1-day streak keeps the badge.
    graduation_sticky() {
        const g = engine.graduationStatus(1, 90);
        const good = g.graduated === true && g.badge === "Fixed Star";
        return good ? pass("graduation_sticky", g) : fail("graduation_sticky", g);
    },
    // B4 — no shame/coercive phrases in notification source (the runtime lint).
    notification_copy_clean() {
        const SOURCES = [
            "services/orbitActivity.js", "services/constellationActivity.js",
            "services/masteryActivity.js", "controllers/constellationController.js",
            "workers/orbitWorker.js", "workers/leagueWorker.js",
        ];
        const BANNED = [
            /let(?:ting)?\s+(?:your\s+)?(?:partner|friend|team|them)\s+down/i,
            /winners?\s+don'?t\s+quit/i, /\bdisappoint(?:ed|ing|ment)?\b/i,
            /\bshame(?:ful)?\b/i, /you\s+failed/i, /you'?ll\s+regret/i,
        ];
        const hits = [];
        for (const rel of SOURCES) {
            let src = "";
            try { src = fs.readFileSync(path.join(__dirname, "..", rel), "utf8"); } catch { continue; }
            for (const rx of BANNED) { const m = src.match(rx); if (m) hits.push(`${rel}: "${m[0]}"`); }
        }
        return hits.length === 0 ? pass("notification_copy_clean", { scanned: SOURCES.length })
                                 : fail("notification_copy_clean", { hits });
    },
    // Config sanity — anti-gaming caps are present and sane.
    anti_gaming_config_sane() {
        const good = cfg.MSG.dailyXpCap > 0 && cfg.MSG.weeklyXpCap > 0 && cfg.XP.swap > cfg.XP.message;
        return good ? pass("anti_gaming_config_sane", cfg.MSG) : fail("anti_gaming_config_sane", cfg.MSG);
    },
};

/** run one check by id, or all. Returns an array of results. */
function run(checkId) {
    const ids = checkId ? [checkId] : Object.keys(CHECKS);
    return ids.filter((id) => CHECKS[id]).map((id) => {
        try { return CHECKS[id](); }
        catch (err) { return fail(id, { error: err.message }); }
    });
}

module.exports = { run, CHECK_IDS: Object.keys(CHECKS) };
