/**
 * adminEconomyController.js — Economy & Photons module (spec A).
 *
 * View global Photon supply (faucets vs sinks), inspect a user's balance + full
 * ledger, manually grant/deduct Photons (reason required, audited, writes a real
 * PhotonLedger entry), and edit the economy earn-rules config (overlay via
 * configStore/economyConfig). Every mutation is RBAC-gated (economy role) and
 * audited with before→after.
 *
 * INVARIANT enforced here: admin Photon actions touch ONLY orbit.stardust and the
 * ledger — never cosmic.score / tierId / league. Photons can't buy rank, for
 * staff either. (Asserted by a unit test.)
 */
const User = require("../models/user");
const PhotonLedger = require("../models/PhotonLedger");
const photonLedger = require("../services/photonLedger");
const economyConfig = require("../services/economyConfig");
const configStore = require("../services/configStore");
const { audit } = require("../utils/adminAudit");

// GET /economy/summary — circulating supply, faucets vs sinks, inflation flag.
exports.summary = async (req, res) => {
    try {
        const events = await PhotonLedger.find().select("delta source createdAt").lean();
        const agg = photonLedger.aggregate(events);
        const [supplyRow] = await User.aggregate([
            { $group: { _id: null, total: { $sum: "$orbit.stardust" }, holders: { $sum: { $cond: [{ $gt: ["$orbit.stardust", 0] }, 1, 0] } }, users: { $sum: 1 } } },
        ]);
        const circulating = supplyRow?.total || 0;
        const holders = supplyRow?.holders || 0;
        return res.json({
            circulating,
            holders,
            avgBalance: holders ? Math.round(circulating / holders) : 0,
            ledger: agg, // { sources, sinks, net, inflation, ... }
        });
    } catch (err) {
        console.error("[admin economy.summary]", err.message);
        return res.status(500).json({ message: "Failed to load economy summary." });
    }
};

// GET /economy/ledger?userId=&page=&limit= — one user's balance + paged ledger.
exports.ledger = async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) return res.status(400).json({ message: "userId is required" });
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
        const user = await User.findById(userId).select("name email orbit.stardust").lean();
        if (!user) return res.status(404).json({ message: "User not found" });
        const [rows, total] = await Promise.all([
            PhotonLedger.find({ userId }).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            PhotonLedger.countDocuments({ userId }),
        ]);
        return res.json({
            user: { _id: user._id, name: user.name, email: user.email, balance: user.orbit?.stardust || 0 },
            rows, total, page, limit, pages: Math.ceil(total / limit),
        });
    } catch (err) {
        console.error("[admin economy.ledger]", err.message);
        return res.status(500).json({ message: "Failed to load ledger." });
    }
};

// POST /economy/adjust { userId, amount, reason } — grant(+)/deduct(-) Photons.
// amount is a signed integer. Writes orbit.stardust + a PhotonLedger row + audit.
exports.adjust = async (req, res) => {
    try {
        const { userId, amount, reason } = req.body || {};
        const amt = parseInt(amount, 10);
        if (!userId || !Number.isFinite(amt) || amt === 0) return res.status(400).json({ message: "userId and a non-zero integer amount are required" });
        if (!reason || !String(reason).trim()) return res.status(400).json({ message: "A reason is required (audited)." });
        if (Math.abs(amt) > 100000) return res.status(400).json({ message: "Amount exceeds the per-action safety cap (100000)." });

        const user = await User.findById(userId).select("name email orbit.stardust cosmic.score cosmic.tierId").lean();
        if (!user) return res.status(404).json({ message: "User not found" });

        const before = user.orbit?.stardust || 0;
        const after = Math.max(0, before + amt); // never drive a balance negative
        const applied = after - before;           // real delta after the floor

        // INVARIANT: touch ONLY the currency field. Never cosmic.score/tierId/league.
        await User.updateOne({ _id: userId }, { $set: { "orbit.stardust": after } });
        photonLedger.record(userId, applied, amt >= 0 ? "admin_grant" : "admin_deduct");

        await audit(req, {
            actorId: req.adminUser._id, actorEmail: req.adminUser.email,
            action: amt >= 0 ? "economy.grant" : "economy.deduct",
            targetType: "user", targetId: userId, reason: String(reason).trim(),
            before: { stardust: before }, after: { stardust: after },
        });
        return res.json({ ok: true, userId, before, after, applied });
    } catch (err) {
        console.error("[admin economy.adjust]", err.message);
        return res.status(500).json({ message: "Adjustment failed." });
    }
};

// GET /economy/config — earn-rules config (default vs current, overridden flag).
exports.getConfig = async (req, res) => {
    try {
        return res.json({ rows: economyConfig.list() });
    } catch (err) {
        console.error("[admin economy.getConfig]", err.message);
        return res.status(500).json({ message: "Failed to load economy config." });
    }
};

// PATCH /economy/config { key, value } — set or clear one economy override.
// value === null clears the override (restores the JS default).
exports.setConfig = async (req, res) => {
    try {
        const { key, value } = req.body || {};
        if (!key || !(key in economyConfig.DEFAULTS)) return res.status(400).json({ message: "Unknown economy config key." });
        const before = economyConfig.value(key);

        if (value === null || value === undefined) {
            await configStore.clear(economyConfig.NS, key);
        } else {
            const num = Number(value);
            if (!Number.isFinite(num) || num < 0) return res.status(400).json({ message: "Value must be a non-negative number." });
            await configStore.set(economyConfig.NS, key, num, req.adminUser.email);
        }
        const after = economyConfig.value(key);
        await audit(req, {
            actorId: req.adminUser._id, actorEmail: req.adminUser.email,
            action: "economy.config.set", targetType: "config", targetId: `${economyConfig.NS}.${key}`,
            before: { [key]: before }, after: { [key]: after },
        });
        return res.json({ ok: true, key, value: after });
    } catch (err) {
        console.error("[admin economy.setConfig]", err.message);
        return res.status(500).json({ message: "Config update failed." });
    }
};
