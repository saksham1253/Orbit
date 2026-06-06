const User = require("../models/user");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// ================= REGISTER =================
exports.register = async (req, res) => {
    try {
        const { name, email, password, languages } = req.body || {};

        // Validation
        if (!name || !email || !password) {
            return res.status(400).json({ message: "All fields are required" });
        }

        // Check existing user
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "User already exists" });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Save user
        const user = new User({
            name,
            email,
            password: hashedPassword,
            languages: languages || ["English"]
        });

        await user.save();

        // Asynchronously send the welcome registration email
        const { sendRegistrationNotification } = require('../utils/sendEmail');
        sendRegistrationNotification(user.email, user.name);

        res.status(201).json({ message: "User registered successfully" });

    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Server error" });
    }
};


// ================= LOGIN =================
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password required"
            });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        // Ethics & Safety Ban Check
        if (user.bannedUntil && new Date() < new Date(user.bannedUntil)) {
            const timeRemaining = Math.ceil((new Date(user.bannedUntil) - new Date()) / (1000 * 60 * 60)); // hours
            return res.status(403).json({ 
                message: `Your account is banned for safety violations. Ban expires in approx. ${timeRemaining} hours.`,
                banned: true,
                timeRemaining
            });
        }

        if (!user.password) {
            return res.status(400).json({
                message: "This account uses Google or GitHub login. Please use the social login buttons below."
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({
                message: "Invalid credentials"
            });
        }

        // Track login activity (used for trust score calculation)
        user.loginCount += 1;
        user.lastLogin   = new Date();
        await user.save();

        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        // Asynchronously send the email notification (don't block the response)
        const { sendLoginNotification } = require('../utils/sendEmail');
        sendLoginNotification(user.email, user.name);

        res.status(200).json({
            message: "Login successful",
            token
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({
            message: "Server error"
        });
    }
};

// ================= FORGOT PASSWORD =================
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: "Email is required" });

        const user = await User.findOne({ email: email.toLowerCase() });
        // Always respond with success to prevent email enumeration
        if (!user) {
            return res.status(200).json({ message: "If an account exists, a reset link has been sent." });
        }

        // Generate a 32-char hex token and store a 1-hour expiry
        const crypto = require('crypto');
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpires = Date.now() + 60 * 60 * 1000; // 1 hour

        // Store hashed token in DB
        user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        user.resetPasswordExpires = resetExpires;
        await user.save();

        const resetUrl = `${process.env.FRONTEND_URL || 'https://react-skill-swap-fully-fledged.vercel.app'}/reset-password/${resetToken}`;

        // Send email
        try {
            const { sendEmail } = require('../utils/sendEmail');
            await sendEmail({
                to: user.email,
                subject: 'SkillSwap – Password Reset',
                html: `<p>Hello ${user.name},</p><p>You requested a password reset. Click the link below (valid for 1 hour):</p><a href="${resetUrl}">${resetUrl}</a><p>If you did not request this, ignore this email.</p>`
            });
        } catch (mailErr) {
            console.error('Forgot password email failed:', mailErr.message);
        }

        res.status(200).json({ message: "If an account exists, a reset link has been sent." });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
};

// ================= RESET PASSWORD =================
exports.resetPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;

        if (!token || !password) {
            return res.status(400).json({ message: "Token and new password are required" });
        }
        if (password.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters" });
        }

        const crypto = require('crypto');
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: "Reset token is invalid or has expired." });
        }

        user.password = await require('bcrypt').hash(password, 10);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        res.status(200).json({ message: "Password reset successfully. You can now log in." });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
};