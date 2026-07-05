/**
 * orbitController.js — the read/claim/spend API for the Orbit Engine.
 * Delegates all math to services/orbitEngine.js and all persistence rules to
 * services/orbitActivity.js. Every handler self-heals the weekly rollovers on
 * read, so a user who's been away still gets the current week's missions and
 * their weekly Gravity Assist.
 */

const User = require("../models/user");
const engine = require("../services/orbitEngine");
const league = require("../services/leagueService");
const cfg = require("../services/orbitConfig");
const flags = require("../services/orbitFlags");
const { utcDayStr, rollForward } = require("../services/orbitActivity");

// Build the client payload from a fully-rolled orbit object.
function shapeOrbit(orbit, now = new Date()) {
    const today = utcDayStr(now);
    const decay = engine.decayState(orbit.streak, today);
    const next = engine.nextMilestone(orbit.streak.current);
    // Graduation phase (Part 3): pressure eases as the habit matures.
    const grad = engine.graduationStatus(orbit.streak.current, orbit.streak.longest, {
        formationMax: cfg.PHASES.formationMax,
        consistencyMax: cfg.PHASES.consistencyMax,
    });
    return {
        streak: {
            current: orbit.streak.current,
            longest: orbit.streak.longest,
            lastActionDay: orbit.streak.lastActionDay,
            state: decay.state,                    // active | decaying | idle
            actedToday: decay.state === "active",
            phase: grad.phase,                     // formation | consistency | graduation
            graduated: grad.graduated,             // sticky (from longest)
            badge: grad.badge,                     // "Fixed Star" | "Constant" | null
            pressure: grad.pressure,               // high | soft | none (UI countdown emphasis)
        },
        prefs: { decayReminders: !(orbit.prefs && orbit.prefs.decayReminders === false) },
        freeze: {
            tokens: orbit.freeze.tokens,
            cap: engine.FREEZE_CAP,
            // Currency rename (Part 0): `costPhotons` is canonical; `costStardust`
            // kept for one release so lagging clients don't break.
            costPhotons: engine.FREEZE_STARDUST_COST,
            costStardust: engine.FREEZE_STARDUST_COST,
        },
        // Part 0: `photons` is the canonical currency field; `stardust` is emitted
        // in parallel through the deprecation window (remove next release).
        photons: orbit.stardust,
        stardust: orbit.stardust,
        missions: (orbit.missions.items || []).map((m) => ({
            key: m.key,
            label: m.label,
            description: m.description,
            metric: m.metric,
            target: m.target,
            progress: m.progress,
            photons: m.stardust,
            stardust: m.stardust,
            claimed: m.claimed,
            complete: m.progress >= m.target,
        })),
        missionsWeekId: orbit.missions.weekId,
        nextMilestone: next,                       // { days, name, stardust } | null
        milestones: engine.MILESTONES,             // full ladder for the UI
        nextResetUTC: `${today}T24:00:00Z`,        // end of the current UTC day
    };
}

// GET /api/orbit/me — the user's full orbit state (self-heals weekly rollovers).
exports.getMyOrbit = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("orbit").lean();
        if (!user) return res.status(404).json({ message: "User not found" });

        const { orbit, changed } = rollForward(user.orbit);
        if (changed) User.updateOne({ _id: req.user.id }, { $set: { orbit } }).catch(() => {});

        // Staged-rollout flags (Part 8) so the UI can hide tiers not live for this user.
        return res.status(200).json({ ...shapeOrbit(orbit), flags: flags.flagsFor(req.user.id) });
    } catch (err) {
        console.error("getMyOrbit error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// POST /api/orbit/prefs — user-controllable engagement preferences (Part 4).
// Currently the decay-reminder opt-out. Additive; body { decayReminders: bool }.
exports.setPrefs = async (req, res) => {
    try {
        const set = {};
        if (typeof req.body.decayReminders === "boolean") {
            set["orbit.prefs.decayReminders"] = req.body.decayReminders;
        }
        if (!Object.keys(set).length) return res.status(400).json({ message: "No valid preferences supplied" });

        await User.updateOne({ _id: req.user.id }, { $set: set });
        const user = await User.findById(req.user.id).select("orbit.prefs").lean();
        return res.status(200).json({ prefs: { decayReminders: !(user.orbit && user.orbit.prefs && user.orbit.prefs.decayReminders === false) } });
    } catch (err) {
        console.error("setPrefs error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// POST /api/orbit/missions/:key/claim — claim a completed mission's Stardust.
exports.claimMission = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("orbit").lean();
        if (!user) return res.status(404).json({ message: "User not found" });

        let { orbit } = rollForward(user.orbit);
        const result = engine.claimMission(orbit.missions, req.params.key);
        if (!result.ok) {
            return res.status(400).json({ message: "Mission not claimable", reason: result.reason });
        }
        orbit.missions = result.missions;
        orbit.stardust += result.stardust;
        // Claiming a mission also grants weekly League XP.
        orbit.league.weekXp += league.XP_MISSION_CLAIM;

        await User.updateOne({ _id: req.user.id }, { $set: { orbit } });
        return res.status(200).json({ awarded: result.stardust, awardedPhotons: result.stardust, ...shapeOrbit(orbit) });
    } catch (err) {
        console.error("claimMission error:", err);
        res.status(500).json({ message: "Server error" });
    }
};

// POST /api/orbit/freeze/buy — spend Stardust for one extra Gravity Assist.
exports.buyFreeze = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("orbit").lean();
        if (!user) return res.status(404).json({ message: "User not found" });

        let { orbit } = rollForward(user.orbit);
        if (orbit.freeze.tokens >= engine.FREEZE_CAP) {
            return res.status(400).json({ message: "Gravity Assist inventory full", reason: "at_cap" });
        }
        if (orbit.stardust < engine.FREEZE_STARDUST_COST) {
            return res.status(400).json({ message: "Not enough Stardust", reason: "insufficient" });
        }
        orbit.stardust -= engine.FREEZE_STARDUST_COST;
        orbit.freeze.tokens = Math.min(engine.FREEZE_CAP, orbit.freeze.tokens + 1);

        await User.updateOne({ _id: req.user.id }, { $set: { orbit } });
        return res.status(200).json({ spent: engine.FREEZE_STARDUST_COST, ...shapeOrbit(orbit) });
    } catch (err) {
        console.error("buyFreeze error:", err);
        res.status(500).json({ message: "Server error" });
    }
};
