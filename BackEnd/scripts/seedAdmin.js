/**
 * seedAdmin.js — one-time (idempotent) bootstrap for the owner admin account.
 *
 *   npm run seed:admin
 *
 * Reads ADMIN_EMAIL + ADMIN_INITIAL_PASSWORD from the environment, finds (or
 * fails clearly if missing) that user, promotes them to role="admin", and stores
 * a bcrypt hash of the initial password in `admin.passwordHash`. TOTP is left
 * DISABLED so the owner is forced to enrol a 2FA authenticator on first login.
 *
 * Nothing sensitive is written to the repo — credentials come only from env.
 * Safe to re-run: it resets the admin password hash and clears any lockout, but
 * never touches the user's normal login password or any other profile data.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const User = require("../models/user");

async function main() {
    const email = (process.env.ADMIN_EMAIL || "").toLowerCase().trim();
    const password = process.env.ADMIN_INITIAL_PASSWORD || "";

    if (!email || !password) {
        console.error("[seed:admin] ADMIN_EMAIL and ADMIN_INITIAL_PASSWORD must both be set in the environment.");
        process.exit(1);
    }
    if (password.length < 12) {
        console.error("[seed:admin] ADMIN_INITIAL_PASSWORD must be at least 12 characters (strong password policy).");
        process.exit(1);
    }
    if (!process.env.MONGO_URI) {
        console.error("[seed:admin] MONGO_URI is not set.");
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);

    const user = await User.findOne({ email });
    if (!user) {
        console.error(`[seed:admin] No account found for ${email}. Register that user normally first, then re-run.`);
        await mongoose.connection.close();
        process.exit(1);
    }

    const passwordHash = await bcrypt.hash(password, 12);

    user.role = "admin";
    user.status = "active";
    user.admin = {
        ...(user.admin || {}),
        passwordHash,
        totpEnabled: false,
        totpSecretEnc: null,
        backupCodeHashes: [],
        failedAttempts: 0,
        lockoutUntil: null,
        tokenVersion: (user.admin?.tokenVersion || 0) + 1, // invalidate any prior admin sessions
    };
    await user.save();

    console.log(`[seed:admin] ✓ ${email} promoted to admin. TOTP enrolment required on first login.`);
    console.log("[seed:admin] Next: open the secret portal slug, sign in, and scan the QR with your authenticator app.");
    await mongoose.connection.close();
    process.exit(0);
}

main().catch(async (err) => {
    console.error("[seed:admin] failed:", err.message);
    try { await mongoose.connection.close(); } catch { /* noop */ }
    process.exit(1);
});
