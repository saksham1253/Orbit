const User = require("../models/user");
const Skill = require("../models/skill");
const Connection = require("../models/Connection");
const { enforceContentPolicy } = require("../utils/contentModeration");

// ================= GET PLATFORM STATS =================
exports.getStats = async (req, res) => {
    try {
        const userCount = await User.countDocuments();
        const skillCount = await Skill.countDocuments();
        const connectionCount = await Connection.countDocuments({ status: 'accepted' });
        
        // Calculate average trust score in the DB (avoids loading every user doc).
        const [agg] = await User.aggregate([
            { $group: { _id: null, avgTrustScore: { $avg: "$trustScore" } } }
        ]);
        const avgTrustScore = agg?.avgTrustScore || 0;

        res.status(200).json({
            users: userCount,
            skills: skillCount,
            connections: connectionCount,
            avgRating: avgTrustScore.toFixed(1)
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Server error" });
    }
};

// ================= GET PROFILE =================
exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("-password");

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json(user);

    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Server error" });
    }
};

// ================= GET PUBLIC PROFILE =================
exports.getPublicProfile = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select("-password -email -loginCount -lastLogin -reportCount -warningCount -banCount -bannedUntil -isFlagged -flagReason");

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json(user);

    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Server error" });
    }
};


// ================= UPDATE PROFILE =================
exports.updateProfile = async (req, res) => {
    try {
        const { name, bio, location, languages, socialLinks } = req.body || {};

        // --- CONTENT MODERATION (same escalating warning/ban as skills) ---
        // Scan the free-text fields a user can put words into (name + bio). A
        // violation is a strike; 3 strikes → a temporary ban, and the profile
        // is NOT saved.
        if (name || bio) {
            const mod = await enforceContentPolicy(req.user.id, [name, bio], { context: 'profile' });
            if (!mod.ok) return res.status(mod.status).json(mod.body);
        }
        // --------------------

        const updatedUser = await User.findByIdAndUpdate(
            req.user.id,
            { name, bio, location, languages, socialLinks },
            { new: true, runValidators: true }
        ).select("-password");

        if (!updatedUser) {
            return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json({
            message: "Profile updated successfully",
            user: updatedUser
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Server error" });
    }
};


// ================= UPLOAD AVATAR (Custom Image) =================
exports.uploadAvatar = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        // Cloudinary URL is in req.file.path
        const avatarUrl = req.file.path;

        const updatedUser = await User.findByIdAndUpdate(
            req.user.id,
            { avatar: avatarUrl },
            { new: true, returnDocument: 'after' }
        ).select("-password");

        if (!updatedUser) {
            return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json({
            message: "Avatar uploaded successfully",
            avatar: avatarUrl,
            user: updatedUser
        });

    } catch (err) {
        console.error("Avatar upload error:", err);
        
        // Better error messages
        if (err.message && err.message.includes('cloud_name')) {
            return res.status(500).json({ 
                message: "Cloudinary not configured. Please add your Cloudinary credentials to .env file." 
            });
        }
        
        res.status(500).json({ 
            message: err.message || "Upload failed. Please try again." 
        });
    }
};


// ================= UPDATE AVATAR URL (Preset or Remove) =================
exports.updateAvatarUrl = async (req, res) => {
    try {
        const { avatar } = req.body || {};

        // Allow empty string to remove avatar and use gradient
        const updatedUser = await User.findByIdAndUpdate(
            req.user.id,
            { avatar: avatar || "" },
            { new: true }
        ).select("-password");

        if (!updatedUser) {
            return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json({
            message: "Avatar updated successfully",
            avatar: updatedUser.avatar,
            user: updatedUser
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Server error" });
    }
};
