const jwt = require("jsonwebtoken");
const User = require("../models/user");

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

        req.user = decoded; // keep it compatible with existing code
        next();

    } catch (err) {
        console.log("JWT Error:", err.message);
        res.status(401).json({ message: "Invalid token" });
    }
};