/**
 * seedAdmin.js — CLI bootstrap for the owner admin account.
 *
 *   npm run seed:admin
 *
 * Connects to MONGO_URI, promotes ADMIN_EMAIL to role="admin", and stores a
 * bcrypt hash of ADMIN_INITIAL_PASSWORD. The actual promotion logic lives in
 * services/adminSeeder.js so the same code can run from a boot hook on hosts
 * without a shell. Idempotent and TOTP-enrolment-preserving.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const { seedAdminUser } = require("../services/adminSeeder");

async function main() {
    if (!process.env.MONGO_URI) {
        console.error("[seed:admin] MONGO_URI is not set.");
        process.exit(1);
    }
    await mongoose.connect(process.env.MONGO_URI);
    const result = await seedAdminUser();
    console.log(`[seed:admin] ✓ ${result.email} is admin.${result.totpEnabled ? " (existing TOTP preserved)" : " TOTP enrolment required on first login."}`);
    await mongoose.connection.close();
    process.exit(0);
}

main().catch(async (err) => {
    console.error("[seed:admin] failed:", err.message);
    try { await mongoose.connection.close(); } catch { /* noop */ }
    process.exit(1);
});
