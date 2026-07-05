/**
 * missionControlController.js — admin API for the Orbit Demo Seeder + Warp Drive
 * (Mission Control C2 / §5). Mounted under the existing admin portal
 * (/api/__ssctl/mission-control/*) behind requireAdmin, so it inherits the
 * portal's RBAC, rate limiting and TOTP session. Every mutation is audited and
 * returns the standard envelope. Destructive/seed/warp ops are blocked on
 * ORBIT_ENV=prod unless an explicit typed confirm phrase is supplied.
 */

const crypto = require("crypto");
const seeder = require("../services/orbitSeeder");
const antiGameSim = require("../services/antiGameSim");
const preflight = require("../services/orbitPreflight");
const fcm = require("../services/fcm");
const User = require("../models/user");
const Skill = require("../models/skill");
const Constellation = require("../models/Constellation");
const { rollForward } = require("../services/orbitActivity");
const { shapeOrbit } = require("./orbitController");
const { masteryFor } = require("../services/skillMastery");
const league = require("../services/leagueService");
const flagStore = require("../services/flagStore");
const analytics = require("../services/orbitAnalytics");
const photonLedger = require("../services/photonLedger");
const { audit } = require("../utils/adminAudit");

const CONFIRM_PHRASE = "SEED";
const isProd = () => (process.env.ORBIT_ENV || "dev").toLowerCase() === "prod";

const reqId = () => { try { return crypto.randomUUID(); } catch { return `req_${Date.now()}`; } };
const ok = (res, data, requestId) => res.status(200).json({ ok: true, data, error: null, requestId });
const fail = (res, code, message, requestId, status = 400) =>
    res.status(status).json({ ok: false, data: null, error: { code, message }, requestId });

// Prod safety gate: on prod, require the typed confirm phrase before any
// destructive/seed/warp op. (Off prod, everything is allowed.)
function prodGuard(req, res, requestId) {
    if (!isProd()) return true;
    if ((req.body && req.body.confirm) === CONFIRM_PHRASE) return true;
    fail(res, "confirm_required", `On prod, pass confirm:"${CONFIRM_PHRASE}" to run this.`, requestId, 403);
    return false;
}

const actor = (req) => ({ actorId: req.adminUser?._id || null, actorEmail: req.adminUser?.email || "" });

// POST /mission-control/seed  { userId?, rivals?, confirm? }
exports.seed = async (req, res) => {
    const requestId = reqId();
    try {
        if (!prodGuard(req, res, requestId)) return;
        const userId = req.body.userId || req.adminUser?._id;
        if (!userId) return fail(res, "user_required", "userId is required", requestId);

        const result = await seeder.seedDemoAccount({ userId, rivals: Number(req.body.rivals) || 29 });
        await audit(req, { ...actor(req), action: "orbit.seed", targetType: "user", targetId: String(userId), after: result.summary });
        return ok(res, result, requestId);
    } catch (err) {
        await audit(req, { ...actor(req), action: "orbit.seed", success: false, reason: err.message });
        return fail(res, "seed_failed", err.message, requestId, 500);
    }
};

// POST /mission-control/warp  { userId, op, value?, confirm? }
exports.warp = async (req, res) => {
    const requestId = reqId();
    try {
        if (!prodGuard(req, res, requestId)) return;
        const { userId, op, value } = req.body || {};
        if (!userId || !op) return fail(res, "bad_request", "userId and op are required", requestId);
        const allowed = ["advance", "rewind", "miss", "jumpMilestone", "rollover"];
        if (!allowed.includes(op)) return fail(res, "bad_op", `op must be one of ${allowed.join(", ")}`, requestId);

        const result = await seeder.warp({ userId, op, value });
        await audit(req, { ...actor(req), action: `orbit.warp.${op}`, targetType: "user", targetId: String(userId), after: result });
        return ok(res, result, requestId);
    } catch (err) {
        await audit(req, { ...actor(req), action: "orbit.warp", success: false, reason: err.message });
        return fail(res, "warp_failed", err.message, requestId, 500);
    }
};

// POST /mission-control/teardown  { userId?, seedRunId?, confirm? }
exports.teardown = async (req, res) => {
    const requestId = reqId();
    try {
        if (!prodGuard(req, res, requestId)) return;
        const { userId, seedRunId } = req.body || {};
        if (!userId && !seedRunId) return fail(res, "bad_request", "userId or seedRunId is required", requestId);

        const result = await seeder.teardown({ userId, seedRunId });
        await audit(req, { ...actor(req), action: "orbit.teardown", targetType: "user", targetId: String(userId || seedRunId), after: result });
        return ok(res, result, requestId);
    } catch (err) {
        await audit(req, { ...actor(req), action: "orbit.teardown", success: false, reason: err.message });
        return fail(res, "teardown_failed", err.message, requestId, 500);
    }
};

// ── C6 · Gravimeter (Photons economy) ────────────────────────────────────────
// GET /mission-control/economy/photons?from=&to=
exports.economy = async (req, res) => {
    const requestId = reqId();
    try {
        const data = await photonLedger.report({ from: req.query.from, to: req.query.to });
        return ok(res, data, requestId);
    } catch (err) {
        return fail(res, "economy_failed", err.message, requestId, 500);
    }
};

// ── C4 · Notification Copy Linter ────────────────────────────────────────────
// GET /mission-control/notifications/lint — runtime shame-phrase lint (B4).
exports.notificationLint = async (req, res) => {
    const requestId = reqId();
    try {
        const [result] = preflight.run("notification_copy_clean");
        return ok(res, { clean: result.status === "pass", ...result.evidence, status: result.status }, requestId);
    } catch (err) {
        return fail(res, "lint_failed", err.message, requestId, 500);
    }
};

// ── C7 · Telemetry (live analytics tail) ─────────────────────────────────────
// GET /mission-control/analytics/recent?limit=&evt=&userId=
exports.analyticsRecent = async (req, res) => {
    const requestId = reqId();
    try {
        const { limit, evt, userId } = req.query || {};
        return ok(res, { events: analytics.recent({ limit: Number(limit) || 100, evt, userId }) }, requestId);
    } catch (err) {
        return fail(res, "analytics_failed", err.message, requestId, 500);
    }
};

// GET /mission-control/analytics/funnels
exports.analyticsFunnels = async (req, res) => {
    const requestId = reqId();
    try {
        return ok(res, { funnels: analytics.funnels() }, requestId);
    } catch (err) {
        return fail(res, "funnels_failed", err.message, requestId, 500);
    }
};

// ── C1 · Flag Cockpit ────────────────────────────────────────────────────────
// GET /mission-control/flags — every managed flag + current/default/meta.
exports.listFlags = async (req, res) => {
    const requestId = reqId();
    try {
        return ok(res, { flags: await flagStore.list() }, requestId);
    } catch (err) {
        return fail(res, "flags_failed", err.message, requestId, 500);
    }
};

// PATCH /mission-control/flags { key, value } — live flip (no redeploy).
exports.setFlag = async (req, res) => {
    const requestId = reqId();
    try {
        const { key, value } = req.body || {};
        if (!key || value === undefined) return fail(res, "bad_request", "key and value are required", requestId);
        if (!flagStore.REGISTRY[key]) return fail(res, "unknown_flag", `unknown flag: ${key}`, requestId);

        const before = flagStore.get(key);
        const updated = await flagStore.set(key, value, req.adminUser?.email || "");
        await audit(req, { ...actor(req), action: "orbit.flag.set", targetType: "flag", targetId: key, before, after: updated.value });
        return ok(res, updated, requestId);
    } catch (err) {
        return fail(res, "flag_set_failed", err.message, requestId, 400);
    }
};

// ── C5 · Player Inspector ────────────────────────────────────────────────────
// GET /mission-control/users/:id/orbit — full gamification state for a user
// (the exact user-facing shape + cosmic + league + Binary Star + mastery).
exports.inspectUser = async (req, res) => {
    const requestId = reqId();
    try {
        const user = await User.findById(req.params.id).select("name email orbit cosmic").lean();
        if (!user) return fail(res, "not_found", "user not found", requestId, 404);

        const { orbit } = rollForward(user.orbit);
        const cons = await Constellation.find({ members: user._id, status: "active" })
            .populate("members", "name").lean();
        const skills = await Skill.find({ userId: user._id }).select("skillOffered sessionsTaught").lean();

        const data = {
            user: { id: String(user._id), name: user.name, email: user.email },
            orbit: shapeOrbit(orbit),
            cosmic: { score: user.cosmic?.score ?? null, tierId: user.cosmic?.tierId ?? null },
            league: { division: league.divisionMeta(orbit.league.divisionId), weekXp: orbit.league.weekXp, lastResult: orbit.league.lastResult },
            constellations: cons.map((c) => ({
                id: String(c._id), streak: c.streak?.current || 0,
                partner: (c.members || []).map((m) => m.name).filter((n) => n !== user.name),
            })),
            mastery: skills.map((s) => masteryFor(s.sessionsTaught, s.skillOffered)).filter((m) => m.sessionsTaught > 0),
            rawOrbit: orbit,
        };
        await audit(req, { ...actor(req), action: "orbit.inspect", targetType: "user", targetId: String(user._id) });
        return ok(res, data, requestId);
    } catch (err) {
        return fail(res, "inspect_failed", err.message, requestId, 500);
    }
};

// ── C3 · Anti-Gaming Simulator (no DB writes) ────────────────────────────────
// POST /mission-control/sim/anti-gaming { targets:[], count, date?, dailyXpCap?, weeklyCap? }
exports.simAntiGaming = async (req, res) => {
    const requestId = reqId();
    try {
        const { targets = [], count = 0, date, dailyXpCap, weeklyCap } = req.body || {};
        if (!Array.isArray(targets) || !count) return fail(res, "bad_request", "targets[] and count are required", requestId);
        const result = antiGameSim.simulate({ targets, count: Number(count), date, dailyXpCap, weeklyCap });
        return ok(res, result, requestId); // pure sim — nothing persisted, no audit needed
    } catch (err) {
        return fail(res, "sim_failed", err.message, requestId, 500);
    }
};

// ── C8 · Pre-Flight Checks ───────────────────────────────────────────────────
// POST /mission-control/preflight/run { checkId? }
exports.preflight = async (req, res) => {
    const requestId = reqId();
    try {
        const results = preflight.run(req.body && req.body.checkId);
        const green = results.every((r) => r.status === "pass");
        return ok(res, { green, results, available: preflight.CHECK_IDS }, requestId);
    } catch (err) {
        return fail(res, "preflight_failed", err.message, requestId, 500);
    }
};

// ── C9 · Push Test Bench ─────────────────────────────────────────────────────
const PUSH_TEMPLATES = {
    message:               { title: "New message (test)", body: "This is a test message push.", link: "/dashboard" },
    connection_request:    { title: "Connection request (test)", body: "Someone wants to connect (test).", link: "/connections" },
    incoming_call:         { title: "Incoming call (test)", body: "Test incoming video call.", link: "/video" },
    constellation_your_turn:{ title: "✨ Your turn to shine (test)", body: "Keep your Binary Star glowing (test).", link: "/orbit" },
    orbit_decay:           { title: "🌌 Orbit decaying (test)", body: "One action keeps your streak alive (test).", link: "/orbit" },
};

// GET /mission-control/push/tokens/:userId
exports.pushTokens = async (req, res) => {
    const requestId = reqId();
    try {
        const user = await User.findById(req.params.userId).select("fcmTokens").lean();
        if (!user) return fail(res, "not_found", "user not found", requestId, 404);
        return ok(res, { count: (user.fcmTokens || []).length, tokens: (user.fcmTokens || []).map((t) => `${t.slice(0, 12)}…`) }, requestId);
    } catch (err) {
        return fail(res, "tokens_failed", err.message, requestId, 500);
    }
};

// POST /mission-control/push/test { userId, eventType }
exports.pushTest = async (req, res) => {
    const requestId = reqId();
    try {
        const { userId, eventType } = req.body || {};
        const tpl = PUSH_TEMPLATES[eventType];
        if (!userId || !tpl) return fail(res, "bad_request", `userId and a known eventType (${Object.keys(PUSH_TEMPLATES).join(", ")}) required`, requestId);
        if (!fcm.isEnabled()) return fail(res, "fcm_disabled", "FCM is not configured on this server", requestId, 503);

        await fcm.sendToUser(userId, { title: tpl.title, body: tpl.body, data: { link: tpl.link, type: eventType, test: "1" } });
        await audit(req, { ...actor(req), action: "orbit.push.test", targetType: "user", targetId: String(userId), after: { eventType } });
        return ok(res, { sent: true, eventType }, requestId);
    } catch (err) {
        return fail(res, "push_failed", err.message, requestId, 500);
    }
};
