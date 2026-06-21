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

        // Throttle the "new login" email so frequent logins don't spam the inbox.
        // Only notify if we haven't already emailed within the cooldown window.
        const LOGIN_EMAIL_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours
        const now = Date.now();
        const lastEmail = user.lastLoginEmailAt ? new Date(user.lastLoginEmailAt).getTime() : 0;
        const shouldEmailLogin = now - lastEmail > LOGIN_EMAIL_COOLDOWN_MS;
        if (shouldEmailLogin) user.lastLoginEmailAt = new Date();

        await user.save();

        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET,
            { expiresIn: "1d" }
        );

        // Asynchronously send the email notification (don't block the response),
        // but only when outside the cooldown window (anti-spam).
        if (shouldEmailLogin) {
            const { sendLoginNotification } = require('../utils/sendEmail');
            sendLoginNotification(user.email, user.name);
        }

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

        // ── Observability (server logs ONLY — never leaked to the client, so the
        // neutral anti-enumeration response below is preserved). This is what
        // reveals a misconfigured mailer in production, where the always-success
        // screen otherwise hides real send failures.
        const emailConfigured = !!(process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS);
        if (!emailConfigured) {
            console.error('[forgot-password] EMAIL_* env vars are not fully configured — reset mail cannot be delivered. Set EMAIL_HOST / EMAIL_PORT / EMAIL_USER / EMAIL_PASS on the host and redeploy.');
        }
        // In non-prod, log the reset link so the flow can be verified without a live inbox.
        if (process.env.NODE_ENV !== 'production') {
            console.log(`[forgot-password] (dev) reset link for ${user.email}: ${resetUrl}`);
        }

        // Send asynchronously (prevents a 15s Axios timeout if SMTP is slow/blocked),
        // but log the resolved messageId on success and the explicit error on failure.
        const { sendPasswordResetEmail } = require('../utils/sendEmail');
        sendPasswordResetEmail({ to: user.email, name: user.name, resetUrl })
            .then(info => console.log(`[forgot-password] reset email queued for ${user.email} — messageId=${info?.messageId || 'n/a'}`))
            .catch(mailErr => console.error(`[forgot-password] reset email FAILED for ${user.email}:`, mailErr?.message || mailErr));

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
        // Enforce the SAME policy as registration (8+ chars, upper, lower,
        // number, special) so reset passwords aren't weaker than signup ones.
        const strong = password.length >= 8
            && /[A-Z]/.test(password)
            && /[a-z]/.test(password)
            && /[0-9]/.test(password)
            && /[^A-Za-z0-9]/.test(password);
        if (!strong) {
            return res.status(400).json({
                message: "Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character."
            });
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