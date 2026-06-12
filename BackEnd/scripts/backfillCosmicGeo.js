/**
 * backfillCosmicGeo.js — one-time, idempotent, re-runnable backfill for the
 * Cosmic Leaderboard feature. Purely ADDITIVE: it only fills NEW fields and
 * never overwrites an existing value or touches any existing field.
 *
 *   1. user.geo.point  ← mirror of the legacy user.coordinates {lat,lng}
 *                         as GeoJSON [lng, lat] (only when missing).
 *   2. rating.tiedToCompletedSwap ← true when a completed Connection exists
 *                         between fromUser and toUser (either direction).
 *
 * Safe to run multiple times. Run manually:
 *     node scripts/backfillCosmicGeo.js
 *
 * Add --dry to preview counts without writing:
 *     node scripts/backfillCosmicGeo.js --dry
 */

require("dotenv").config();
const mongoose = require("mongoose");

const User       = require("../models/user");
const Rating     = require("../models/rating");
const Connection = require("../models/Connection");

const DRY = process.argv.includes("--dry");

async function backfillGeoPoints() {
    // Users that have legacy coordinates but no GeoJSON point yet.
    const cursor = User.find({
        "coordinates.lat": { $ne: null },
        "coordinates.lng": { $ne: null },
        "geo.point": { $exists: false }
    }).select("_id coordinates").cursor();

    let updated = 0;
    for (let user = await cursor.next(); user != null; user = await cursor.next()) {
        const { lat, lng } = user.coordinates || {};
        if (typeof lat !== "number" || typeof lng !== "number") continue;

        if (!DRY) {
            await User.updateOne(
                { _id: user._id },
                { $set: { "geo.point": { type: "Point", coordinates: [lng, lat] } } }
            );
        }
        updated++;
    }
    return updated;
}

async function backfillCompletedSwapFlags() {
    // Only ratings that haven't been flagged yet (additive, idempotent).
    const cursor = Rating.find({ tiedToCompletedSwap: { $ne: true } })
        .select("_id fromUser toUser").cursor();

    let flagged = 0;
    for (let rating = await cursor.next(); rating != null; rating = await cursor.next()) {
        const completed = await Connection.exists({
            status: "completed",
            $or: [
                { requester: rating.fromUser, receiver: rating.toUser },
                { requester: rating.toUser,   receiver: rating.fromUser }
            ]
        });

        if (completed) {
            if (!DRY) {
                await Rating.updateOne(
                    { _id: rating._id },
                    { $set: { tiedToCompletedSwap: true } }
                );
            }
            flagged++;
        }
    }
    return flagged;
}

async function main() {
    if (!process.env.MONGO_URI) {
        console.error("MONGO_URI is not set. Aborting.");
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log(`[backfillCosmicGeo] connected${DRY ? " (DRY RUN — no writes)" : ""}`);

    const geoCount  = await backfillGeoPoints();
    console.log(`[backfillCosmicGeo] geo.point ${DRY ? "would set" : "set"} for ${geoCount} user(s)`);

    const swapCount = await backfillCompletedSwapFlags();
    console.log(`[backfillCosmicGeo] tiedToCompletedSwap ${DRY ? "would set" : "set"} on ${swapCount} rating(s)`);

    await mongoose.connection.close();
    console.log("[backfillCosmicGeo] done.");
    process.exit(0);
}

main().catch((err) => {
    console.error("[backfillCosmicGeo] error:", err);
    process.exit(1);
});
