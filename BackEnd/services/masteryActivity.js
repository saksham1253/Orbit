/**
 * masteryActivity.js — the DB layer for Skill Mastery (Orbit Engine, Tier 3).
 *
 * When a swap completes, the OWNER of the swapped skill (who offered to teach
 * it) gets one "session taught" toward that skill's mastery ladder. Crossing a
 * mastery threshold awards Stardust once and notifies them. All best-effort:
 * never throws into and never blocks the caller's request path. Ladder math is
 * delegated to services/skillMastery.js (pure).
 */

const Skill = require("../models/skill");
const User = require("../models/user");
const { tierReachedOnIncrement, masteryFor } = require("./skillMastery");
const { createNotification } = require("./notify");

/**
 * creditTeaching — increment the skill's sessionsTaught and, if a mastery rank
 * was newly reached, award Stardust to the skill owner + notify. Fire-and-forget.
 *
 * @param {object|null} io       socket.io server
 * @param {string} skillId       the Connection's skill (the taught skill)
 * @returns {Promise<object|null>} summary or null
 */
async function creditTeaching(io, skillId) {
    try {
        if (!skillId) return null;
        // Atomic increment; return the NEW doc so we know the post-increment count.
        const skill = await Skill.findByIdAndUpdate(
            skillId,
            { $inc: { sessionsTaught: 1 } },
            { new: true }
        ).lean();
        if (!skill) return null;

        const newCount = skill.sessionsTaught || 0;
        const prevCount = newCount - 1;
        const crossed = tierReachedOnIncrement(prevCount, newCount);

        if (crossed) {
            // Award Stardust to the teacher (the skill owner) for the new rank.
            await User.updateOne({ _id: skill.userId }, { $inc: { "orbit.stardust": crossed.stardust } });
            require("./photonLedger").record(skill.userId, crossed.stardust, "mastery"); // C6 economy
            const view = masteryFor(newCount, skill.skillOffered);
            createNotification(io, skill.userId, {
                type: "skill_mastery",
                title: `🎓 ${view.badge}!`,
                body: `${newCount} session${newCount === 1 ? "" : "s"} taught in ${skill.skillOffered} — recognized with +${crossed.stardust} ✨ Photons.`,
                data: { link: "/dashboard", skillId: String(skill._id), rank: crossed.title, stardust: crossed.stardust },
            }).catch(() => {});
        }

        return { skillId: String(skill._id), sessionsTaught: newCount, rankReached: crossed ? crossed.title : null };
    } catch (err) {
        console.warn("[mastery] creditTeaching failed:", err.message);
        return null;
    }
}

module.exports = { creditTeaching };
