const Skill = require("../models/skill");
const User = require("../models/user");
const Connection = require("../models/Connection");
const MatchNotification = require("../models/matchNotification");
const mongoose = require("mongoose");
const { validateSkillContent } = require("../utils/bannedKeywords");
const { tierObjectFor } = require("../services/cosmicTier");

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

        // --- COMPREHENSIVE CONTENT MODERATION ---
        const contentValidation = validateSkillContent(
            `${skillOffered} ${skillWanted}`, 
            description || ''
        );
        
        if (!contentValidation.isValid) {
            const user = await User.findById(req.user.id);
            user.warningCount += 1;
            
            if (user.warningCount >= 3) {
                const banHours = 10 + (user.banCount * 5);
                user.bannedUntil = new Date(Date.now() + banHours * 60 * 60 * 1000);
                user.banCount += 1;
                user.warningCount = 0;
                await user.save();
                
                return res.status(403).json({
                    message: `Account temporarily suspended for ${banHours} hours due to repeated community guideline violations.`,
                    banned: true,
                    timeRemaining: banHours,
                    violationType: 'content_policy',
                    showLargeWarning: true
                });
            } else {
                await user.save();
                return res.status(400).json({
                    message: `⚠️ WARNING ${user.warningCount}/3: ${contentValidation.message}`,
                    warningCount: user.warningCount,
                    remainingWarnings: 3 - user.warningCount,
                    violationType: 'content_policy',
                    showLargeWarning: true
                });
            }
        }
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
                    const pairKey = MatchNotification.keyFor(req.user.id, otherId);
                    try {
                        await MatchNotification.create({ pairKey });
                    } catch (dupErr) {
                        if (dupErr && dupErr.code === 11000) continue; // already announced
                        throw dupErr;
                    }

                    // Notify the POSTER about this existing match (the asymmetry
                    // bug: previously only the other side ever heard about it).
                    io.to(`user_${req.user.id}`).emit("perfect-match", {
                        otherUser: {
                            _id: otherId,
                            name: match.userId.name || "Someone",
                            avatar: match.userId.avatar
                        },
                        youTeach: skillOffered,
                        youLearn: skillWanted
                    });

                    // Notify the OTHER user, framed from THEIR point of view.
                    io.to(`user_${otherId}`).emit("perfect-match", {
                        otherUser: {
                            _id: req.user.id,
                            name: user?.name || "Someone",
                            avatar: user?.avatar
                        },
                        youTeach: match.skillOffered,
                        youLearn: match.skillWanted
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
        // (in-memory; no extra DB round-trip — v7 §1).
        for (const s of skills) {
            if (s.userId) s.userId.cosmicStanding = standingFromUser(s.userId);
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

        // --- COMPREHENSIVE CONTENT MODERATION ---
        const contentValidation = validateSkillContent(
            `${skillOffered || skill.skillOffered} ${skillWanted || skill.skillWanted}`, 
            description !== undefined ? description : skill.description || ''
        );
        
        if (!contentValidation.isValid) {
            const user = await User.findById(req.user.id);
            user.warningCount += 1;
            
            if (user.warningCount >= 3) {
                const banHours = 10 + (user.banCount * 5);
                user.bannedUntil = new Date(Date.now() + banHours * 60 * 60 * 1000);
                user.banCount += 1;
                user.warningCount = 0;
                await user.save();
                
                return res.status(403).json({
                    message: `Account temporarily suspended for ${banHours} hours due to repeated community guideline violations.`,
                    banned: true,
                    timeRemaining: banHours,
                    violationType: 'content_policy',
                    showLargeWarning: true
                });
            } else {
                await user.save();
                return res.status(400).json({
                    message: `⚠️ WARNING ${user.warningCount}/3: ${contentValidation.message}`,
                    warningCount: user.warningCount,
                    remainingWarnings: 3 - user.warningCount,
                    violationType: 'content_policy',
                    showLargeWarning: true
                });
            }
        }
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