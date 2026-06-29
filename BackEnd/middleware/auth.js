const jwt = require("jsonwebtoken");
const User = require("../models/user");
const { seasonIdFor } = require("../services/seasonService");

module.exports = async (req, res, next) => {
    try {
        const authHeader = req.header("Authorization");

        if (!authHeader) {
            return res.status(401).json({ message: "No token provided" });
        }

        const token = authHeader.split(" ")[1];

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Fetch user from DB to check for bans
        const user = await User.findById(decoded.id);
        if (!user) {
            return res.status(401).json({ message: "User no longer exists" });
        }

        // Ethics & Safety Ban Check
        if (user.bannedUntil && new Date() < new Date(user.bannedUntil)) {
            const timeRemaining = Math.ceil((new Date(user.bannedUntil) - new Date()) / (1000 * 60 * 60)); // hours
            return res.status(403).json({ 
                message: `Your account is banned for safety violations. Ban expires in approx. ${timeRemaining} hours.`,
                banned: true 
            });
        }

        // ── Cosmic activity heartbeat (at most once per UTC day) ──────────────
        // Revives the activity component of the CosmicScore: cosmic.activeDays-
        // ThisSeason was never incremented anywhere, so 8% of every score was
        // permanently 0. We bump it once per day per active user, and self-heal
        // the season scoping (resetting to 1 when the month rolls over) so a user
        // the season worker hasn't touched still gets counted. Best-effort —
        // never block or fail a request over activity tracking.
        try {
            const todayUTC = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
            const cosmic = user.cosmic || {};
            if (cosmic.lastActiveDay !== todayUTC) {
                const currentSeason = seasonIdFor(new Date());
                const update = cosmic.seasonId !== currentSeason
                    ? { $set: { "cosmic.lastActiveDay": todayUTC, "cosmic.seasonId": currentSeason, "cosmic.activeDaysThisSeason": 1 } }
                    : { $set: { "cosmic.lastActiveDay": todayUTC }, $inc: { "cosmic.activeDaysThisSeason": 1 } };
                await User.updateOne({ _id: user._id }, update);
            }
        } catch (_) {
            /* non-critical */
        }

        req.user = decoded; // keep it compatible with existing code
        next();

    } catch (err) {
        console.log("JWT Error:", err.message);
        res.status(401).json({ message: "Invalid token" });
    }
};