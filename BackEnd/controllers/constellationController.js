/**
 * constellationController.js — co-op Binary Star API (Orbit Engine, Tier 2).
 * Invite a swap partner, accept/decline, dissolve, and read your constellations
 * with their shared-streak state. Math is delegated to constellationEngine.js.
 */

const Constellation = require("../models/Constellation");
const Connection = require("../models/Connection");
const User = require("../models/user");
const engine = require("../services/constellationEngine");
const { utcDayStr, isoWeekId } = require("../services/orbitActivity");
const { createNotification } = require("../services/notify");

// Shape one populated constellation for the viewer.
function shape(con, meId, today) {
    const memberIds = con.members.map((m) => String(m._id || m));
    const partnerDoc = con.members.find((m) => String(m._id || m) !== String(meId));
    const decay = engine.pairDecayState(con.streak, con.lastActionDay, memberIds, today);
    const iActedToday = (con.lastActionDay || {})[String(meId)] === today;
    return {
        id: String(con._id),
        status: con.status,
        invitedByMe: String(con.invitedBy) === String(meId),
        partner: partnerDoc ? {
            id: String(partnerDoc._id),
            name: partnerDoc.name,
            avatar: partnerDoc.avatar || "",
        } : null,
        streak: {
            current: con.streak.current,
            longest: con.streak.longest,
            state: decay.state,             // active | waiting | decaying | idle
            iActedToday,
        },
        freeze: { tokens: (con.freeze && con.freeze.tokens) || 0, cap: engine.FREEZE_CAP_PAIR },
        nextMilestone: engine.nextPairMilestone(con.streak.current),
        milestones: engine.PAIR_MILESTONES,
    };
}

// GET /api/orbit/constellations — active constellations + pending invites.
exports.getMine = async (req, res) => {
    try {
        const meId = req.user.id;
        const today = utcDayStr();
        const cons = await Constellation.find({ members: meId, status: { $in: ["active", "pending"] } })
            .populate("members", "name avatar")
            .sort({ "streak.current": -1, updatedAt: -1 })
            .lean();

        const active = [], incoming = [], outgoing = [];
        for (const c of cons) {
            const shaped = shape(c, meId, today);
            if (c.status === "active") active.push(shaped);
            else if (shaped.invitedByMe) outgoing.push(shaped);
            else incoming.push(shaped);
        }
        return res.status(200).json({ active, incoming, outgoing });
    } catch (err) {
        console.error("getMine (constellations) error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// POST /api/orbit/constellations/invite { partnerId }
exports.invite = async (req, res) => {
    try {
        const meId = req.user.id;
        const { partnerId } = req.body || {};
        if (!partnerId) return res.status(400).json({ message: "partnerId is required" });
        if (String(partnerId) === String(meId)) return res.status(400).json({ message: "You can't form a constellation with yourself" });

        const partner = await User.findById(partnerId).select("name avatar").lean();
        if (!partner) return res.status(404).json({ message: "Partner not found" });

        // Must share an established connection (accepted or completed swap).
        const connected = await Connection.exists({
            status: { $in: ["accepted", "completed"] },
            $or: [
                { requester: meId, receiver: partnerId },
                { requester: partnerId, receiver: meId },
            ],
        });
        if (!connected) return res.status(403).json({ message: "You can only pair with a connected partner" });

        const pairKey = engine.pairKeyOf(meId, partnerId);
        const existing = await Constellation.findOne({ pairKey, status: { $in: ["active", "pending"] } }).lean();
        if (existing) {
            return res.status(409).json({ message: existing.status === "active" ? "You already share a Binary Star" : "An invite is already pending" });
        }

        const members = [meId, partnerId].sort();   // stable ordering; pairKey is canonical
        const con = await Constellation.create({ members, pairKey, invitedBy: meId, status: "pending" });

        const me = await User.findById(meId).select("name").lean();
        createNotification(req.app.get("io"), partnerId, {
            type: "constellation_invite",
            title: "✨ Binary Star invite",
            body: `${(me && me.name) || "A partner"} wants to form a co-op streak with you.`,
            data: { link: "/orbit", constellationId: String(con._id) },
        }).catch(() => {});

        return res.status(201).json({ id: String(con._id), status: "pending" });
    } catch (err) {
        if (err.code === 11000) return res.status(409).json({ message: "A constellation already exists for this pair" });
        console.error("invite (constellation) error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// POST /api/orbit/constellations/:id/respond { action: 'accept' | 'decline' }
exports.respond = async (req, res) => {
    try {
        const meId = req.user.id;
        const { action } = req.body || {};
        if (!["accept", "decline"].includes(action)) return res.status(400).json({ message: "Invalid action" });

        const con = await Constellation.findById(req.params.id);
        if (!con || con.status !== "pending") return res.status(404).json({ message: "Invite not found" });
        if (!con.members.map(String).includes(String(meId))) return res.status(403).json({ message: "Not your invite" });
        if (String(con.invitedBy) === String(meId)) return res.status(403).json({ message: "Only the invitee can respond" });

        if (action === "decline") {
            con.status = "dissolved";
            con.dissolvedAt = new Date();
            await con.save();
            return res.status(200).json({ status: "dissolved" });
        }

        // Accept → activate + seed the first weekly shared Gravity Assist.
        require("../services/orbitAnalytics").track("binary_star.create", { userId: String(meId), constellationId: String(con._id) });
        con.status = "active";
        con.activatedAt = new Date();
        const g = engine.grantWeeklyFreezePair(con.freeze, isoWeekId());
        con.freeze = g.freeze;
        await con.save();

        const me = await User.findById(meId).select("name").lean();
        createNotification(req.app.get("io"), con.invitedBy, {
            type: "constellation_accepted",
            title: "🌟 Binary Star formed",
            body: `${(me && me.name) || "Your partner"} accepted — your shared streak starts when you both act on the same day.`,
            data: { link: "/orbit", constellationId: String(con._id) },
        }).catch(() => {});

        return res.status(200).json({ status: "active" });
    } catch (err) {
        console.error("respond (constellation) error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// POST /api/orbit/constellations/:id/dissolve
exports.dissolve = async (req, res) => {
    try {
        const meId = req.user.id;
        const con = await Constellation.findById(req.params.id);
        if (!con || con.status === "dissolved") return res.status(404).json({ message: "Constellation not found" });
        if (!con.members.map(String).includes(String(meId))) return res.status(403).json({ message: "Not your constellation" });

        con.status = "dissolved";
        con.dissolvedAt = new Date();
        await con.save();
        require("../services/orbitAnalytics").track("binary_star.dissolve", { userId: String(meId), constellationId: String(con._id) });

        const otherId = con.members.map(String).find((m) => m !== String(meId));
        if (otherId) {
            createNotification(req.app.get("io"), otherId, {
                type: "constellation_dissolved",
                title: "🌑 Binary Star dissolved",
                body: "A co-op streak you shared was ended.",
                data: { link: "/orbit", constellationId: String(con._id) },
            }).catch(() => {});
        }
        return res.status(200).json({ status: "dissolved" });
    } catch (err) {
        console.error("dissolve (constellation) error:", err);
        res.status(500).json({ message: "Server error" });
    }
};
