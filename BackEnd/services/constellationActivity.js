/**
 * constellationActivity.js — the DB layer for co-op Binary Star streaks.
 *
 * recordPairAction() is called from orbitActivity.recordOrbitAction after the
 * personal streak is applied: it records the acting user's contribution to each
 * of their ACTIVE constellations and, when both partners have acted the same
 * UTC day, advances the shared streak (freeze-bridged) and credits BOTH members
 * with any milestone Stardust. Best-effort — never throws into the caller.
 *
 * All math is delegated to services/constellationEngine.js (pure); the "now"
 * (UTC day / ISO week) is owned here, shared with services/orbitActivity.js.
 */

const Constellation = require("../models/Constellation");
const User = require("../models/user");
const engine = require("./constellationEngine");
const { utcDayStr, isoWeekId } = require("./orbitActivity");
const { createNotification } = require("./notify");

// Apply the lazy weekly freeze grant to a constellation doc for `weekId`.
function rollForwardPair(con, weekId) {
    const g = engine.grantWeeklyFreezePair(con.freeze || {}, weekId);
    con.freeze = g.freeze;
    return g.granted;
}

/**
 * recordPairAction — fan a member's real-progress action into their active
 * constellations. Fire-and-forget.
 *
 * @param {object|null} io
 * @param {string} userId
 * @param {object} [opts] { now = new Date() }
 * @returns {Promise<Array>} per-constellation summaries (empty on none/failure)
 */
async function recordPairAction(io, userId, opts = {}) {
    try {
        const now = opts.now || new Date();
        const today = utcDayStr(now);
        const weekId = isoWeekId(now);

        const cons = await Constellation.find({ members: userId, status: "active" });
        if (!cons.length) return [];

        const summaries = [];
        for (const con of cons) {
            rollForwardPair(con, weekId);

            const memberIds = con.members.map(String);
            const state = {
                streak: con.streak,
                lastActionDay: con.lastActionDay || {},
                freezeTokens: (con.freeze && con.freeze.tokens) || 0,
            };
            const res = engine.applyPairContribution(state, userId, memberIds, today);

            // Persist streak + contribution + freeze.
            con.streak = res.state.streak;
            con.lastActionDay = res.state.lastActionDay;
            con.markModified("lastActionDay");
            con.freeze.tokens = res.state.freezeTokens;
            await con.save();

            // On a shared advance, notify both. On a milestone, pay both.
            const otherId = memberIds.find((m) => m !== String(userId));
            if (res.advanced) {
                if (res.milestone) {
                    await User.updateMany(
                        { _id: { $in: con.members } },
                        { $inc: { "orbit.stardust": res.milestone.stardust } }
                    );
                    for (const m of memberIds) {
                        createNotification(io, m, {
                            type: "constellation_milestone",
                            title: `⭐ ${res.milestone.name}!`,
                            body: `Your Binary Star hit a ${con.streak.current}-day shared streak — +${res.milestone.stardust} ✨ Photons each.`,
                            data: { link: "/orbit", constellationId: String(con._id), stardust: res.milestone.stardust, photons: res.milestone.stardust },
                        }).catch(() => {});
                    }
                } else {
                    // Notify the partner that the shared streak moved (the actor sees it live).
                    createNotification(io, otherId, {
                        type: "constellation_streak",
                        title: "✨ Binary Star advanced",
                        body: `You both showed up today — shared streak is now ${con.streak.current} days.`,
                        data: { link: "/orbit", constellationId: String(con._id), streak: con.streak.current },
                    }).catch(() => {});
                }
                if (res.streakSaved) {
                    for (const m of memberIds) {
                        createNotification(io, m, {
                            type: "constellation_freeze_used",
                            title: "🛡️ Shared Gravity Assist",
                            body: `A missed day was bridged — your Binary Star's ${con.streak.current}-day streak is intact.`,
                            data: { link: "/orbit", constellationId: String(con._id) },
                        }).catch(() => {});
                    }
                }
            } else if (res.recorded && engine.pairDecayState(con.streak, con.lastActionDay, memberIds, today).state === "waiting") {
                // Part 4 — gentle, non-coercive nudge to the person who can act.
                // Never framed to make them feel they're letting their partner down.
                createNotification(io, otherId, {
                    type: "constellation_your_turn",
                    title: "✨ It's your turn to shine",
                    body: `Your partner showed up today — whenever you're ready, one action keeps your ${con.streak.current}-day Binary Star glowing.`,
                    data: { link: "/orbit", constellationId: String(con._id), streak: con.streak.current },
                }).catch(() => {});
            }

            summaries.push({
                constellationId: String(con._id),
                advanced: res.advanced,
                streak: con.streak.current,
                milestone: res.milestone ? res.milestone.name : null,
            });
        }
        return summaries;
    } catch (err) {
        console.warn("[constellation] recordPairAction failed:", err.message);
        return [];
    }
}

module.exports = { recordPairAction, rollForwardPair };
