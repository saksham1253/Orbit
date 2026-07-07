/**
 * adminProgressionController.js — Streaks + Ranking module (spec F + G).
 *
 * SUPPORT TOOLS (safe, I/O-only, audited): look up a user's progression, adjust
 * or restore a streak, and grant Gravity Assist freeze tokens. These touch only
 * the orbit.streak / orbit.freeze fields — never cosmic.score / rank.
 *
 * CONFIG VIEW: a consolidated, live read of the progression tuning — streak
 * milestones, graduation phases, Gravity Assist economics, CosmicScore weights,
 * and league division rules. Freeze/active-day economics are runtime-editable via
 * the economy overlay (Economy → Earn Rules); the rest are surfaced as live
 * reference (code/env-configured) so staff can see the exact values in effect.
 *
 * Mutations require the "support" portal role (superadmin always passes).
 */
const User = require("../models/user");
const engine = require("../services/orbitEngine");
const orbitConfig = require("../services/orbitConfig");
const economyConfig = require("../services/economyConfig");
const cosmicScore = require("../services/cosmicScore");
const league = require("../services/leagueService");
const { audit } = require("../utils/adminAudit");

// GET /progression/user/:id — streak + freeze + league + cosmic snapshot.
exports.getUser = async (req, res) => {
    try {
        const u = await User.findById(req.params.id)
            .select("name email orbit.streak orbit.freeze orbit.league cosmic.score cosmic.tierId").lean();
        if (!u) return res.status(404).json({ message: "User not found" });
        return res.json({
            user: { _id: u._id, name: u.name, email: u.email },
            streak: u.orbit?.streak || {},
            freeze: u.orbit?.freeze || {},
            league: u.orbit?.league || {},
            cosmic: { score: u.cosmic?.score ?? null, tierId: u.cosmic?.tierId ?? null },
        });
    } catch (err) {
        console.error("[admin progression.getUser]", err.message);
        return res.status(500).json({ message: "Failed to load user progression." });
    }
};

// POST /progression/user/:id/streak { current, longest, reason } — adjust/restore.
exports.adjustStreak = async (req, res) => {
    try {
        const { current, longest, reason } = req.body || {};
        if (!reason || !String(reason).trim()) return res.status(400).json({ message: "A reason is required (audited)." });
        const cur = parseInt(current, 10);
        if (!Number.isFinite(cur) || cur < 0 || cur > 100000) return res.status(400).json({ message: "current must be a non-negative integer." });

        const u = await User.findById(req.params.id).select("orbit.streak cosmic.score").lean();
        if (!u) return res.status(404).json({ message: "User not found" });
        const before = u.orbit?.streak || {};
        const nextLongest = Number.isFinite(parseInt(longest, 10)) ? parseInt(longest, 10) : Math.max(before.longest || 0, cur);

        // Only the streak fields change — never cosmic.score / rank.
        await User.updateOne({ _id: req.params.id }, { $set: { "orbit.streak.current": cur, "orbit.streak.longest": nextLongest } });
        await audit(req, {
            actorId: req.adminUser._id, actorEmail: req.adminUser.email, action: "progression.streak.adjust",
            targetType: "user", targetId: req.params.id, reason: String(reason).trim(),
            before: { current: before.current, longest: before.longest }, after: { current: cur, longest: nextLongest },
        });
        return res.json({ ok: true, current: cur, longest: nextLongest });
    } catch (err) {
        console.error("[admin progression.adjustStreak]", err.message);
        return res.status(500).json({ message: "Adjust failed." });
    }
};

// POST /progression/user/:id/freeze { tokens, reason } — grant Gravity Assist.
exports.grantFreeze = async (req, res) => {
    try {
        const { tokens, reason } = req.body || {};
        if (!reason || !String(reason).trim()) return res.status(400).json({ message: "A reason is required (audited)." });
        const n = parseInt(tokens, 10);
        if (!Number.isFinite(n) || n === 0 || Math.abs(n) > 100) return res.status(400).json({ message: "tokens must be a non-zero integer (±100 max)." });

        const cap = economyConfig.value("FREEZE_CAP");
        const u = await User.findById(req.params.id).select("orbit.freeze").lean();
        if (!u) return res.status(404).json({ message: "User not found" });
        const before = u.orbit?.freeze?.tokens || 0;
        // Support grants may exceed the normal earn cap slightly, but stay bounded.
        const after = Math.max(0, Math.min(cap + 5, before + n));

        await User.updateOne({ _id: req.params.id }, { $set: { "orbit.freeze.tokens": after } });
        await audit(req, {
            actorId: req.adminUser._id, actorEmail: req.adminUser.email, action: "progression.freeze.grant",
            targetType: "user", targetId: req.params.id, reason: String(reason).trim(),
            before: { tokens: before }, after: { tokens: after },
        });
        return res.json({ ok: true, tokens: after });
    } catch (err) {
        console.error("[admin progression.grantFreeze]", err.message);
        return res.status(500).json({ message: "Grant failed." });
    }
};

// GET /progression/config — consolidated live tuning (editable flags per group).
exports.getConfig = async (req, res) => {
    try {
        return res.json({
            streaks: {
                editable: false,
                milestones: engine.MILESTONES,          // [{ days, name, stardust }]
                phases: orbitConfig.PHASES,
            },
            gravityAssist: {
                editable: true,                          // via Economy → Earn Rules (economy overlay)
                cap: economyConfig.value("FREEZE_CAP"),
                weeklyGrant: economyConfig.value("WEEKLY_FREEZE_GRANT"),
                cost: economyConfig.value("FREEZE_STARDUST_COST"),
            },
            ranking: {
                editable: false,
                cosmicWeights: cosmicScore.WEIGHTS,      // { rating, sentiment, swaps, activity }
            },
            leagues: {
                editable: false,
                divisions: league.DIVISIONS,
                groupSize: league.GROUP_SIZE,
                promoteCount: league.PROMOTE_COUNT,
                relegateCount: league.RELEGATE_COUNT,
            },
        });
    } catch (err) {
        console.error("[admin progression.getConfig]", err.message);
        return res.status(500).json({ message: "Failed to load progression config." });
    }
};
