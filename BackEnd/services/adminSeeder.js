/**
 * adminSeeder.js — shared, idempotent owner-admin promotion logic, callable both
 * from the CLI (`npm run seed:admin`) and from a guarded boot hook on hosts with
 * no shell (Render free tier). Assumes Mongoose is already connected.
 *
 * Safe to re-run: it (re)sets the bcrypt password hash from ADMIN_INITIAL_PASSWORD
 * and clears lockouts, but PRESERVES an existing TOTP enrolment so restarts never
 * force you to re-enrol your authenticator.
 */
const bcrypt = require("bcrypt");
const User = require("../models/user");

async function seedAdminUser() {
    const email = (process.env.ADMIN_EMAIL || "").toLowerCase().trim();
    const password = process.env.ADMIN_INITIAL_PASSWORD || "";

    if (!email || !password) throw new Error("ADMIN_EMAIL and ADMIN_INITIAL_PASSWORD must both be set.");
    if (password.length < 12) throw new Error("ADMIN_INITIAL_PASSWORD must be at least 12 characters.");

    const user = await User.findOne({ email });
    if (!user) throw new Error(`No account found for ${email}. Register that user normally first, then re-run.`);

    const passwordHash = await bcrypt.hash(password, 12);
    const wasAdmin = user.role === "admin";

    user.role = "admin";
    user.status = "active";
    user.admin = user.admin || {};
    user.admin.passwordHash = passwordHash;
    user.admin.failedAttempts = 0;
    user.admin.lockoutUntil = null;
    // Preserve an existing TOTP enrolment; only initialise it the first time.
    if (!user.admin.totpEnabled) {
        user.admin.totpEnabled = false;
        user.admin.totpSecretEnc = null;
        user.admin.backupCodeHashes = [];
    }
    // Only invalidate prior sessions on the FIRST promotion (avoids logging the
    // admin out on every restart if a boot-seed flag is left enabled).
    if (!wasAdmin) user.admin.tokenVersion = (user.admin.tokenVersion || 0) + 1;

    await user.save();
    return { email: user.email, totpEnabled: user.admin.totpEnabled, wasAlreadyAdmin: wasAdmin };
}

module.exports = { seedAdminUser };
