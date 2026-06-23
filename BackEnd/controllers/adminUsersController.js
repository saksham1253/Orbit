/**
 * adminUsersController.js — user management for the Command Center. All handlers
 * run behind requireAdmin and write to the AuditLog on every mutation.
 *
 * Enforcement note: suspension/ban reuse the EXISTING `bannedUntil` field that
 * the user auth middleware already checks — so blocking a login needs no change
 * to user-facing auth. `status` is the admin-facing label kept in sync.
 */
const crypto = require("crypto");
const User = require("../models/user");
const Rating = require("../models/rating");
const Connection = require("../models/Connection");
const CallHistory = require("../models/callHistory");
const { audit } = require("../utils/adminAudit");

const SAFE_LIST = "name email avatar location city region country role status trustScore cosmic.score cosmic.tierId createdAt lastLogin bannedUntil";
const FAR_FUTURE = new Date("9999-01-01T00:00:00Z");

// GET /users?q&page&limit&status&role
exports.listUsers = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
        const q = (req.query.q || "").trim();
        const filter = {};
        if (req.query.status) filter.status = req.query.status;
        // Soft-deleted users are hidden from the default list (they're managed in
        // Records); they only appear when explicitly filtered for above.
        else filter.status = { $ne: "soft_deleted" };
        if (req.query.role) filter.role = req.query.role;
        if (q) {
            const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
            filter.$or = [{ name: rx }, { email: rx }, { city: rx }, { location: rx }];
        }
        const [rows, total] = await Promise.all([
            User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).select(SAFE_LIST).lean(),
            User.countDocuments(filter),
        ]);
        // Accounts created before role/status/cosmic were added to the schema have
        // those fields genuinely missing (Mongoose defaults only apply to NEW docs,
        // never backfilled). Coalesce to the schema defaults so every row renders a
        // real value instead of a blank badge. Also flag live online presence.
        const online = req.app.get("onlineUsers");
        const shaped = rows.map((u) => ({
            ...u,
            role: u.role || "user",
            status: u.status || "active",
            cosmic: { ...(u.cosmic || {}), tierId: u.cosmic?.tierId || "moon_4" },
            online: online ? online.has(String(u._id)) : false,
        }));
        return res.json({ rows: shaped, total, page, limit, pages: Math.ceil(total / limit) });
    } catch (err) {
        console.error("[admin listUsers]", err.message);
        return res.status(500).json({ message: "Failed to list users." });
    }
};

// GET /users/:id — full detail
exports.getUser = async (req, res) => {
    try {
        const u = await User.findById(req.params.id).select("-password -admin.passwordHash -admin.totpSecretEnc -admin.backupCodeHashes").lean();
        if (!u) return res.status(404).json({ message: "Not found" });

        const [ratingsGot, ratingsGave, swaps, calls, recentRatings] = await Promise.all([
            Rating.countDocuments({ toUser: u._id }),
            Rating.countDocuments({ fromUser: u._id }),
            Connection.countDocuments({ status: "completed", $or: [{ requester: u._id }, { receiver: u._id }] }),
            CallHistory.countDocuments({ $or: [{ caller: u._id }, { receiver: u._id }] }),
            Rating.find({ toUser: u._id }).sort({ createdAt: -1 }).limit(5).populate("fromUser", "name").lean(),
        ]);

        await audit(req, { actorId: req.adminUser._id, actorEmail: req.adminUser.email, action: "user.view", targetType: "user", targetId: String(u._id) });
        return res.json({
            user: u,
            stats: { ratingsReceived: ratingsGot, ratingsGiven: ratingsGave, completedSwaps: swaps, calls },
            recentRatings,
            security: { loginCount: u.loginCount, lastLogin: u.lastLogin, bannedUntil: u.bannedUntil, isFlagged: u.isFlagged, flagReason: u.flagReason, role: u.role, status: u.status },
        });
    } catch (err) {
        console.error("[admin getUser]", err.message);
        return res.status(500).json({ message: "Failed to load user." });
    }
};

// PATCH /users/:id — edit a safe subset of profile fields
exports.updateUser = async (req, res) => {
    try {
        const allowed = ["name", "bio", "location"];
        const before = await User.findById(req.params.id).select(allowed.join(" ")).lean();
        if (!before) return res.status(404).json({ message: "Not found" });
        const set = {};
        for (const k of allowed) if (k in req.body) set[k] = req.body[k];
        if (!Object.keys(set).length) return res.status(400).json({ message: "No editable fields provided." });
        await User.updateOne({ _id: req.params.id }, { $set: set });
        await audit(req, { actorId: req.adminUser._id, actorEmail: req.adminUser.email, action: "user.update", targetType: "user", targetId: req.params.id, reason: req.body.reason || "", before, after: set });
        return res.json({ ok: true });
    } catch (err) {
        console.error("[admin updateUser]", err.message);
        return res.status(500).json({ message: "Update failed." });
    }
};

// POST /users/:id/role { role, reason }
exports.setRole = async (req, res) => {
    try {
        const role = req.body.role;
        if (!["user", "moderator", "admin"].includes(role)) return res.status(400).json({ message: "Invalid role." });
        const before = await User.findById(req.params.id).select("role email").lean();
        if (!before) return res.status(404).json({ message: "Not found" });
        // Guard: an admin cannot demote themselves (avoid locking out the portal).
        if (String(req.params.id) === String(req.adminUser._id) && role !== "admin") {
            return res.status(400).json({ message: "You cannot change your own admin role." });
        }
        await User.updateOne({ _id: req.params.id }, { $set: { role } });
        await audit(req, { actorId: req.adminUser._id, actorEmail: req.adminUser.email, action: "user.role", targetType: "user", targetId: req.params.id, reason: req.body.reason || "", before: { role: before.role }, after: { role } });
        return res.json({ ok: true });
    } catch (err) {
        console.error("[admin setRole]", err.message);
        return res.status(500).json({ message: "Role change failed." });
    }
};

// POST /users/:id/status { status, reason, days? }
exports.setStatus = async (req, res) => {
    try {
        const status = req.body.status;
        if (!["active", "suspended", "banned"].includes(status)) return res.status(400).json({ message: "Invalid status." });
        const before = await User.findById(req.params.id).select("status banndUntil banCount email").lean();
        if (!before) return res.status(404).json({ message: "Not found" });
        if (String(req.params.id) === String(req.adminUser._id)) {
            return res.status(400).json({ message: "You cannot change your own status." });
        }
        const set = { status };
        const inc = {};
        if (status === "banned") { set.bannedUntil = FAR_FUTURE; inc.banCount = 1; }
        else if (status === "suspended") {
            const days = Math.min(365, Math.max(1, parseInt(req.body.days, 10) || 7));
            set.bannedUntil = new Date(Date.now() + days * 86400000);
        } else { set.bannedUntil = null; } // active → lift
        await User.updateOne({ _id: req.params.id }, { $set: set, ...(Object.keys(inc).length ? { $inc: inc } : {}) });
        await audit(req, { actorId: req.adminUser._id, actorEmail: req.adminUser.email, action: `user.status.${status}`, targetType: "user", targetId: req.params.id, reason: req.body.reason || "", before: { status: before.status }, after: set });
        return res.json({ ok: true });
    } catch (err) {
        console.error("[admin setStatus]", err.message);
        return res.status(500).json({ message: "Status change failed." });
    }
};

// POST /users/:id/reset-password — issue a reset token + email (reuses mailer)
exports.triggerPasswordReset = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).json({ message: "Not found" });
        const resetToken = crypto.randomBytes(32).toString("hex");
        user.resetPasswordToken = crypto.createHash("sha256").update(resetToken).digest("hex");
        user.resetPasswordExpires = Date.now() + 60 * 60 * 1000;
        await user.save();
        const resetUrl = `${process.env.FRONTEND_URL || "https://react-skill-swap-fully-fledged.vercel.app"}/reset-password/${resetToken}`;
        try {
            const { sendEmail } = require("../utils/sendEmail");
            await sendEmail({
                to: user.email, subject: "Orbit – Password Reset",
                html: `<p>Hello ${user.name},</p><p>An administrator initiated a password reset. This link is valid for 1 hour:</p><a href="${resetUrl}">${resetUrl}</a>`,
            });
        } catch (mailErr) { console.error("[admin reset email]", mailErr.message); }
        await audit(req, { actorId: req.adminUser._id, actorEmail: req.adminUser.email, action: "user.password_reset", targetType: "user", targetId: req.params.id, reason: req.body.reason || "" });
        return res.json({ ok: true });
    } catch (err) {
        console.error("[admin triggerPasswordReset]", err.message);
        return res.status(500).json({ message: "Reset failed." });
    }
};
