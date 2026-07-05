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
