const Skill = require("../models/skill");
const User = require("../models/user");
const Connection = require("../models/Connection");
const MatchNotification = require("../models/matchNotification");
const mongoose = require("mongoose");
const { enforceContentPolicy } = require("../utils/contentModeration");
const { tierObjectFor } = require("../services/cosmicTier");
const { createNotification } = require("../services/notify");
const { masteryFor } = require("../services/skillMastery");

// Lean cosmic standing for list cards (Browse/Matches). Computed in-memory from
// the user's PERSISTED cosmic fields — no extra DB query, no N+1 (v7 §1). Same
// tier service the leaderboard uses, so it's a single source of truth. Anchored
// on the stored tierId so the badge matches the user's persisted tier.
const standingFromUser = (u) => {
    const score = (u && u.cosmic && typeof u.cosmic.score === "number") ? u.cosmic.score : 50;
    const tierId = (u && u.cosmic && u.cosmic.tierId) || "moon_4";
    const t = tierObjectFor(tierId, score);
    return { tierId: t.tierId, score: Math.round(score * 10) / 10, displayName: t.displayName, progress: t.progress };
};

// ================= ADD SKILL =================
exports.addSkill = async (req, res) => {
    try {
        const { skillOffered, skillWanted, description, level } = req.body || {};

        if (!skillOffered || !skillWanted) {
            return res.status(400).json({
                message: "Skill offered and wanted are required"
            });
        }

        // --- EXACT-DUPLICATE GUARD ---
        // Block re-adding the SAME pair (same teach + same learn, case/space
        // insensitive). The REVERSE pair (teach/learn swapped) is a genuinely
        // different offer and is intentionally allowed — so we only reject when
        // BOTH sides match exactly.
        const escExact = (str) => String(str || "").trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const dup = await Skill.findOne({
            userId: req.user.id,
            skillOffered: { $regex: `^${escExact(skillOffered)}$`, $options: "i" },
            skillWanted:  { $regex: `^${escExact(skillWanted)}$`,  $options: "i" },
        }).lean();
        if (dup) {
            return res.status(409).json({
                message: "You've already added this exact pair. Tip: the reverse pair (swap teach ↔ learn) is allowed.",
            });
        }
        // --------------------

        // --- CONTENT MODERATION (shared escalating warning/ban) ---
        const mod = await enforceContentPolicy(
            req.user.id,
            [skillOffered, skillWanted, description],
            { context: 'skill' }
        );
        if (!mod.ok) return res.status(mod.status).json(mod.body);
        // --------------------

        const skill = new Skill({
            userId: req.user.id,
            skillOffered,
            skillWanted,
            description,
            level
        });

        await skill.save();

        const user = await User.findById(req.user.id).select("name avatar");

        // Find potential matches and notify them
        const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const potentialMatches = await Skill.find({
            userId: { $ne: req.user.id },
            skillOffered: { $regex: escapeRegex(skillWanted), $options: "i" },
            skillWanted: { $regex: escapeRegex(skillOffered), $options: "i" }
        }).populate('userId', 'name avatar trustScore').limit(10);

        const io = req.app.get("io");
        if (io) {
            // Broadcast new skill so everyone's Browse list refreshes live.
            // (No global toast — that was phantom noise; the client only uses
            // this to invalidate the skills query. v7 §3.)
            io.emit("new-skill", {
                _id: skill._id,
                userId: user,
                skillOffered: skill.skillOffered,
                skillWanted: skill.skillWanted,
                description: skill.description,
                level: skill.level,
                createdAt: skill.createdAt
            });

            // Perfect-match notification (v7 §3): a reciprocal pair is announced
            // to BOTH people exactly once. De-duped per user-pair so adding more
            // skills later never re-spams, and skipped if the two are already
            // connected (they don't need a "found a match" nudge).
            for (const match of potentialMatches) {
                const otherId = match.userId && match.userId._id;
                if (!otherId) continue;

                try {
                    const alreadyConnected = await Connection.exists({
                        $or: [
                            { requester: req.user.id, receiver: otherId },
                            { requester: otherId, receiver: req.user.id }
                        ]
                    });
                    if (alreadyConnected) continue;

                    // Unique pairKey insert is the de-dupe gate: a duplicate-key
                    // error means this pair was already announced — skip silently.
                    // Key on the user pair AND the matched skill pair, so a
                    // distinct reciprocal pair between the same two users still
                    // announces (but the same pair never re-spams). v7 §3.
                    const pairKey = MatchNotification.keyFor(req.user.id, otherId, skillOffered, skillWanted);
                    try {
                        await MatchNotification.create({ pairKey });
                    } catch (dupErr) {
                        if (dupErr && dupErr.code === 11000) continue; // already announced
                        throw dupErr;
                    }

                    const matchName = match.userId.name || "Someone";
                    const posterName = user?.name || "Someone";
                    const bodyFor = (name, teach, learn) =>
                        `You can learn ${learn} from ${name} and teach them ${teach}.`;

                    // Notify the POSTER about this existing match (the asymmetry
                    // bug: previously only the other side ever heard about it).
                    // Persist + keep the existing live "perfect-match" toast.
                    await createNotification(io, req.user.id, {
                        type: "perfect_match",
                        title: "Perfect Match Found!",
                        body: bodyFor(matchName, skillOffered, skillWanted),
                        data: { otherUserId: String(otherId), youTeach: skillOffered, youLearn: skillWanted, link: `/profile/${otherId}` },
                        legacy: {
                            event: "perfect-match",
                            payload: {
                                otherUser: { _id: otherId, name: matchName, avatar: match.userId.avatar },
                                youTeach: skillOffered,
                                youLearn: skillWanted,
                            },
                        },
                    });

                    // Notify the OTHER user, framed from THEIR point of view.
                    await createNotification(io, otherId, {
                        type: "perfect_match",
                        title: "Perfect Match Found!",
                        body: bodyFor(posterName, match.skillOffered, match.skillWanted),
                        data: { otherUserId: String(req.user.id), youTeach: match.skillOffered, youLearn: match.skillWanted, link: `/profile/${req.user.id}` },
                        legacy: {
                            event: "perfect-match",
                            payload: {
                                otherUser: { _id: req.user.id, name: posterName, avatar: user?.avatar },
                                youTeach: match.skillOffered,
                                youLearn: match.skillWanted,
                            },
                        },
                    });
                } catch (notifyErr) {
                    // Notifications are best-effort — never fail the skill add.
                    console.error("perfect-match notify error:", notifyErr);
                }
            }
        }

        res.status(201).json({
            message: "Skill added successfully",
            skill
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Server error" });
    }
};


// ================= GET ALL SKILLS =================
exports.getAllSkills = async (req, res) => {
    try {
        const skills = await Skill.aggregate([
            { $match: { userId: { $ne: new mongoose.Types.ObjectId(req.user.id) } } },
            { $lookup: {
                from: "users",
                localField: "userId",
                foreignField: "_id",
                as: "userId"
            }},
            { $unwind: "$userId" },
            { $match: {
                "userId.trustScore": { $gt: 35 },
                $or: [
                    { "userId.bannedUntil": null },
                    { "userId.bannedUntil": { $lte: new Date() } }
                ]
            }},
            // Sort by sentimentScore (0-1) first, then trustScore as tiebreaker
            { $sort: { "userId.sentimentScore": -1, "userId.trustScore": -1 } },
            { $limit: 50 },
            { $project: {
                "userId.password": 0,
                "userId.loginCount": 0,
                "userId.reportCount": 0,
                "userId.isFlagged": 0,
                "userId.flagReason": 0,
                "userId.bannedUntil": 0
            }}
        ]);

        // Attach each user's cosmic standing for the Browse card mini-badge
        // (in-memory; no extra DB round-trip — v7 §1) + per-skill mastery.
        for (const s of skills) {
            if (s.userId) s.userId.cosmicStanding = standingFromUser(s.userId);
            s.mastery = masteryFor(s.sessionsTaught, s.skillOffered);
        }

        res.status(200).json(skills);

    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Server error" });
    }
};


// ================= GET MY SKILLS =================
exports.getMySkills = async (req, res) => {
    try {
        const skills = await Skill.find({ userId: req.user.id }).lean();
        for (const s of skills) s.mastery = masteryFor(s.sessionsTaught, s.skillOffered);

        res.status(200).json(skills);

    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};


// ================= UPDATE SKILL =================
exports.updateSkill = async (req, res) => {
    try {
        const { skillOffered, skillWanted, description, level } = req.body || {};

        const skill = await Skill.findOne({ _id: req.params.id, userId: req.user.id });

        if (!skill) {
            return res.status(404).json({ message: "Skill not found or unauthorized" });
        }

        // --- CONTENT MODERATION (shared escalating warning/ban) ---
        const mod = await enforceContentPolicy(
            req.user.id,
            [
                skillOffered || skill.skillOffered,
                skillWanted || skill.skillWanted,
                description !== undefined ? description : skill.description,
            ],
            { context: 'skill' }
        );
        if (!mod.ok) return res.status(mod.status).json(mod.body);
        // --------------------

        if (skillOffered) skill.skillOffered = skillOffered;
        if (skillWanted)  skill.skillWanted  = skillWanted;
        if (description !== undefined) skill.description = description;
        if (level)        skill.level        = level;

        await skill.save();

        res.status(200).json({ message: "Skill updated successfully", skill });

    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Server error" });
    }
};


// ================= DELETE SKILL =================
exports.deleteSkill = async (req, res) => {
    try {
        const skill = await Skill.findOneAndDelete({ _id: req.params.id, userId: req.user.id });

        if (!skill) {
            return res.status(404).json({ message: "Skill not found or unauthorized" });
        }

        // Clear the perfect-match de-dupe rows tied to THIS skill pair for this
        // user. The pairKey is `<userA>__<userB>::<skillX>|<skillY>` (ids and
        // skills each sorted). Without this, once a pair was announced the row
        // lived forever — so deleting a skill and re-adding it (or its reverse)
        // never re-announced the match. Removing the skill resets that memory,
        // so a genuine re-add fires the perfect-match notification again.
        try {
            const norm = (s) => String(s || "").trim().toLowerCase();
            const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const skillKey = esc([norm(skill.skillOffered), norm(skill.skillWanted)].sort().join("|"));
            const uid = esc(String(req.user.id));
            // Match either user position in the sorted id pair, then this skill pair.
            const re = new RegExp(`^(?:${uid}__[0-9a-fA-F]{24}|[0-9a-fA-F]{24}__${uid})::${skillKey}$`);
            await MatchNotification.deleteMany({ pairKey: re });
        } catch (cleanupErr) {
            // De-dupe cleanup is best-effort — never fail the delete over it.
            console.error("match-dedupe cleanup error:", cleanupErr);
        }

        res.status(200).json({ message: "Skill deleted successfully" });

    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Server error" });
    }
};


// ================= SKILL MATCHING =================
// Finds users whose skillOffered matches what YOU want, and whose skillWanted matches what YOU offer
exports.getMatches = async (req, res) => {
    try {
        // Get current user's skills
        const mySkills = await Skill.find({ userId: req.user.id });

        if (mySkills.length === 0) {
            return res.status(200).json({ message: "Add your skills first to find matches", matches: [] });
        }

        // Build the $or conditions for matching using regex (allows partial matches)
        // Ensure special regex characters are escaped safely by just matching words
        const matchConditions = mySkills.map(mySkill => {
            const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            return {
                skillOffered: { $regex: escapeRegex(mySkill.skillWanted), $options: "i" },
                skillWanted: { $regex: escapeRegex(mySkill.skillOffered), $options: "i" }
            };
        });

        const matches = await Skill.aggregate([
            { $match: { 
                userId: { $ne: new mongoose.Types.ObjectId(req.user.id) },
                $or: matchConditions
            } },
            { $lookup: {
                from: "users",
                localField: "userId",
                foreignField: "_id",
                as: "userId"
            }},
            { $unwind: "$userId" },
            { $match: {
                "userId.trustScore": { $gt: 35 },
                $or: [
                    { "userId.bannedUntil": null },
                    { "userId.bannedUntil": { $lte: new Date() } }
                ]
            }},
            { $sort: { "userId.sentimentScore": -1, "userId.trustScore": -1 } },
            { $limit: 50 },
            { $project: {
                "userId.password": 0,
                "userId.loginCount": 0,
                "userId.reportCount": 0,
                "userId.isFlagged": 0,
                "userId.flagReason": 0,
                "userId.bannedUntil": 0
            }}
        ]);

        // Attach each matched user's cosmic standing so the Matches card shows
        // the same tier mini-badge as Browse (single source of truth — v7 §1).
        for (const m of matches) {
            if (m.userId) m.userId.cosmicStanding = standingFromUser(m.userId);
        }

        res.status(200).json({ matches });

    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Server error" });
    }
};