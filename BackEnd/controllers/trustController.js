const User   = require("../models/user");
const Rating = require("../models/rating");
const mlService = require("../services/mlService");

// ─────────────────────────────────────────────
//  TRUST SCORE FORMULA
//
//  Trust Score (0–100) is built from 4 factors:
//  1. Average rating from other users     → 40 pts max
//  2. Number of ratings (experience)      → 20 pts max
//  3. Account age                         → 20 pts max
//  4. Activity bonus                      → 20 pts max
//  Penalty: fraud flags / reports deduct points
// ─────────────────────────────────────────────

function calculateTrustScore(user, ratingStats) {
    let score = 0;

    // 1. Rating score (0–40 pts)
    //    avg 5.0 → 40, avg 4.0 → 32, avg 3.0 → 24 ...
    if (ratingStats.count > 0) {
        score += (ratingStats.avg / 5) * 40;
    } else {
        score += 10; // neutral baseline for new users
    }

    // 2. Experience — number of ratings received (0–20 pts)
    //    10+ ratings → full 20 pts
    const expScore = Math.min(ratingStats.count / 10, 1) * 20;
    score += expScore;

    // 3. Account age (0–20 pts)
    //    1 year old account → full 20 pts
    const ageInDays = (Date.now() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24);
    const ageScore  = Math.min(ageInDays / 365, 1) * 20;
    score += ageScore;

    // 4. Activity bonus (0–20 pts)
    //    Based on login count, capped at 50 logins for full score
    const activityScore = Math.min(user.loginCount / 50, 1) * 20;
    score += activityScore;

    // Fraud penalty
    if (user.isFlagged)      score -= 30;
    if (user.reportCount > 0) score -= (user.reportCount * 5);

    // Clamp between 0 and 100
    return Math.max(0, Math.min(100, Math.round(score)));
}


// ─────────────────────────────────────────────
//  FRAUD DETECTION RULES
//  Returns { flagged: bool, reason: string }
// ─────────────────────────────────────────────

function detectFraud(user, recentRatings) {
    // Rule 1: Too many reports
    if (user.reportCount >= 3) {
        return { flagged: true, reason: "Multiple user reports received" };
    }

    // Rule 2: Sudden drop in ratings (last 3 ratings all 1-star)
    if (recentRatings.length >= 3) {
        const allLow = recentRatings.every(r => r.score <= 2);
        if (allLow) {
            return { flagged: true, reason: "Consistently low recent ratings" };
        }
    }

    // Rule 3: Very high activity in short time (possible bot)
    if (user.loginCount > 200) {
        const accountAgeDays = (Date.now() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24);
        if (accountAgeDays < 7) {
            return { flagged: true, reason: "Suspicious login activity on new account" };
        }
    }

    return { flagged: false, reason: "" };
}


// ─────────────────────────────────────────────
//  SUBMIT A RATING
// ─────────────────────────────────────────────

exports.submitRating = async (req, res) => {
    try {
        const { toUserId, score, review, skillContext } = req.body || {};

        if (!toUserId || !score) {
            return res.status(400).json({ message: "toUserId and score are required" });
        }

        if (req.user.id === toUserId) {
            return res.status(400).json({ message: "You cannot rate yourself" });
        }

        if (score < 1 || score > 5) {
            return res.status(400).json({ message: "Score must be between 1 and 5" });
        }

        const targetUser = await User.findById(toUserId);
        if (!targetUser) {
            return res.status(404).json({ message: "User not found" });
        }

        // Upsert — update if already rated, else create
        await Rating.findOneAndUpdate(
            { fromUser: req.user.id, toUser: toUserId },
            { score, review, skillContext },
            { upsert: true, new: true }
        );

        // Recalculate trust score AND sentiment score for the rated user
        await recalculateTrustScore(toUserId);

        res.status(201).json({ message: "Rating submitted successfully" });

    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Server error" });
    }
};


// ─────────────────────────────────────────────
//  GET RATINGS FOR A USER
// ─────────────────────────────────────────────

exports.getUserRatings = async (req, res) => {
    try {
        const userId  = req.params.userId;
        const ratings = await Rating.find({ toUser: userId })
            .populate("fromUser", "name avatar")
            .sort({ createdAt: -1 });

        const user = await User.findById(userId).select("name avatar trustScore averageRating totalRatings isFlagged");

        if (!user) return res.status(404).json({ message: "User not found" });

        res.status(200).json({ user, ratings });

    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Server error" });
    }
};


// ─────────────────────────────────────────────
//  GET MY TRUST SCORE
// ─────────────────────────────────────────────

exports.getMyTrustScore = async (req, res) => {
    try {
        const user = await User.findById(req.user.id)
            .select("name trustScore averageRating totalRatings isFlagged flagReason loginCount createdAt");

        if (!user) return res.status(404).json({ message: "User not found" });

        // Get recent ratings for breakdown
        const ratings = await Rating.find({ toUser: req.user.id })
            .populate("fromUser", "name avatar")
            .sort({ createdAt: -1 })
            .limit(5);

        // Score breakdown for transparency
        const ageInDays   = (Date.now() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24);
        const breakdown   = {
            ratingScore:   user.averageRating > 0 ? Math.round((user.averageRating / 5) * 40) : 10,
            experienceScore: Math.round(Math.min(user.totalRatings / 10, 1) * 20),
            ageScore:      Math.round(Math.min(ageInDays / 365, 1) * 20),
            activityScore: Math.round(Math.min(user.loginCount / 50, 1) * 20),
            penalty:       user.isFlagged ? -30 : 0
        };

        res.status(200).json({
            trustScore:    user.trustScore,
            averageRating: user.averageRating,
            totalRatings:  user.totalRatings,
            isFlagged:     user.isFlagged,
            flagReason:    user.flagReason,
            breakdown,
            recentRatings: ratings
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Server error" });
    }
};


// ─────────────────────────────────────────────
//  REPORT A USER (fraud signal)
// ─────────────────────────────────────────────

exports.reportUser = async (req, res) => {
    try {
        const { userId, reason } = req.body || {};

        if (!userId) return res.status(400).json({ message: "userId is required" });
        if (req.user.id === userId) return res.status(400).json({ message: "Cannot report yourself" });

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        user.reportCount += 1;

        // Run fraud detection
        const recentRatings = await Rating.find({ toUser: userId }).sort({ createdAt: -1 }).limit(5);
        const fraud = detectFraud(user, recentRatings);

        if (fraud.flagged) {
            user.isFlagged  = true;
            user.flagReason = fraud.reason;
        }

        await user.save();
        await recalculateTrustScore(userId);

        res.status(200).json({ message: "User reported successfully" });

    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Server error" });
    }
};


// ─────────────────────────────────────────────
//  INTERNAL: Recalculate and save trust score
// ─────────────────────────────────────────────

async function recalculateTrustScore(userId) {
    const user    = await User.findById(userId);
    const ratings = await Rating.find({ toUser: userId }).lean();

    const count = ratings.length;
    const avg   = count > 0
        ? ratings.reduce((sum, r) => sum + r.score, 0) / count
        : 0;

    const recentRatings = ratings.slice(-5);
    const fraud         = detectFraud(user, recentRatings);

    if (fraud.flagged && !user.isFlagged) {
        user.isFlagged  = true;
        user.flagReason = fraud.reason;
    }

    user.totalRatings  = count;
    user.averageRating = Math.round(avg * 10) / 10;
    user.trustScore    = calculateTrustScore(user, { count, avg });

    // ─────────────────────────────────────────────
    // SENTIMENT ANALYSIS: Star Rating Average Method
    // Convert average rating (1-5 scale) to sentiment score (0-1 scale)
    // This ensures Browse Skills sorts by user reputation
    // ─────────────────────────────────────────────
    if (count > 0) {
        user.sentimentScore = avg / 5; // Normalize to 0-1 scale
    } else {
        user.sentimentScore = 0.5; // Neutral for users with no ratings
    }

    await user.save();
}

// ─────────────────────────────────────────────
//  GET MY GIVEN RATINGS
// ─────────────────────────────────────────────

exports.getMyGivenRatings = async (req, res) => {
    try {
        const ratings = await Rating.find({ fromUser: req.user.id })
            .populate("toUser", "name avatar trustScore")
            .sort({ createdAt: -1 })
            .limit(20);

        res.status(200).json({ ratings });
    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Server error" });
    }
};

module.exports.recalculateTrustScore = recalculateTrustScore;
