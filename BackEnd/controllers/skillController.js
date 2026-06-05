const Skill = require("../models/skill");
const User = require("../models/user");
const mongoose = require("mongoose");
const { validateSkillContent } = require("../utils/bannedKeywords");

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
            // Broadcast new skill to all users
            io.emit("new-skill", {
                _id: skill._id,
                userId: user,
                skillOffered: skill.skillOffered,
                skillWanted: skill.skillWanted,
                description: skill.description,
                level: skill.level,
                createdAt: skill.createdAt
            });

            // Notify potential matches
            potentialMatches.forEach(match => {
                if (match.userId && match.userId._id) {
                    io.to(`user_${match.userId._id}`).emit("skill-match", {
                        matchedUser: {
                            _id: req.user.id,
                            name: user?.name || "Someone",
                            avatar: user?.avatar
                        },
                        skill: {
                            skillOffered: skillOffered,
                            skillWanted: skillWanted
                        }
                    });
                }
            });
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
            { $sort: { "userId.trustScore": -1 } },
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

        res.status(200).json({ matches });

    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Server error" });
    }
};