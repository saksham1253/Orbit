/**
 * seedOrbitDemo.js — CLI for the Orbit demo seeder + time-travel (Mission
 * Control §5). Shares services/orbitSeeder.js with the (future) admin API, so
 * seeded state is produced ONE way and is identical to organically-earned state.
 *
 *   npm run seed:orbit-demo -- --user <id>                 # fill all tiers
 *   npm run seed:orbit-demo -- --user <id> --advance 1     # +1 day
 *   npm run seed:orbit-demo -- --user <id> --miss-day      # simulate a miss
 *   npm run seed:orbit-demo -- --user <id> --jump-milestone 100
 *   npm run seed:orbit-demo -- --user <id> --run-rollover  # weekly league rollover
 *   npm run seed:orbit-demo -- --user <id> --teardown      # undo exactly
 *
 * Safety: refuses to run against ORBIT_ENV=prod without --force.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const seeder = require("../services/orbitSeeder");

function arg(name, fallback = undefined) {
    const i = process.argv.indexOf(`--${name}`);
    if (i === -1) return fallback;
    const next = process.argv[i + 1];
    return next && !next.startsWith("--") ? next : true; // flag or value
}

async function main() {
    if (!process.env.MONGO_URI) { console.error("[seed:orbit-demo] MONGO_URI is not set."); process.exit(1); }

    const userId = arg("user");
    if (!userId) { console.error("[seed:orbit-demo] --user <id> is required."); process.exit(1); }

    const env = (process.env.ORBIT_ENV || "dev").toLowerCase();
    if (env === "prod" && !arg("force")) {
        console.error("[seed:orbit-demo] refusing to run on prod without --force.");
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);
    const now = new Date();
    try {
        let result;
        if (arg("teardown")) {
            result = await seeder.teardown({ userId });
        } else if (arg("advance")) {
            result = await seeder.warp({ userId, op: "advance", now });
        } else if (arg("rewind")) {
            result = await seeder.warp({ userId, op: "rewind", now });
        } else if (arg("miss-day")) {
            result = await seeder.warp({ userId, op: "miss", now });
        } else if (arg("jump-milestone")) {
            result = await seeder.warp({ userId, op: "jumpMilestone", value: Number(arg("jump-milestone")), now });
        } else if (arg("run-rollover")) {
            result = await seeder.warp({ userId, op: "rollover", now });
        } else {
            const rivals = Number(arg("rivals")) || 29;
            result = await seeder.seedDemoAccount({ userId, now, rivals });
        }
        console.log("[seed:orbit-demo] ✓", JSON.stringify(result, null, 2));
    } finally {
        await mongoose.connection.close();
    }
    process.exit(0);
}

main().catch(async (err) => {
    console.error("[seed:orbit-demo] failed:", err.message);
    try { await mongoose.connection.close(); } catch { /* noop */ }
    process.exit(1);
});
