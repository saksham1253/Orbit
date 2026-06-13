/**
 * sentimentWorker.js — precomputes BERT sentiment for reviews, OFF the request
 * path (spec §14). Mirrors the archiveWorker pattern: an in-process scheduled
 * batch (no external cron needed on Render's long-lived process).
 *
 * Strictly additive & non-destructive:
 *   - writes ONLY to rating.sentiment{} (never touches rating.score/rating.review)
 *   - also backfills rating.tiedToCompletedSwap when a completed swap exists
 *   - leaves sentiment null when BERT is unavailable, so the composite score
 *     gracefully redistributes weight to the raw rating (never blocks the board)
 *
 * Free-tier safe: small batches, throttled between calls to respect the
 * Hugging Face free Inference API. Reuses the existing mlService.analyzeSentiment
 * (DistilBERT SST-2) — no new dependency, no new model host.
 */

const Rating = require("../models/rating");
const Connection = require("../models/Connection");
const mlService = require("../services/mlService");

const MODEL_ID = "distilbert-base-uncased-finetuned-sst-2-english";
const BATCH_SIZE = Number(process.env.COSMIC_SENTIMENT_BATCH) || 20;
const INTERVAL_MS = Number(process.env.COSMIC_SENTIMENT_INTERVAL_MS) || 15 * 60 * 1000; // 15 min
const THROTTLE_MS = Number(process.env.COSMIC_SENTIMENT_THROTTLE_MS) || 1200;            // between calls

const labelFor = (s) => (s > 0.25 ? "positive" : s < -0.25 ? "negative" : "neutral");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function isTiedToCompletedSwap(fromUser, toUser) {
    const c = await Connection.exists({
        status: "completed",
        $or: [
            { requester: fromUser, receiver: toUser },
            { requester: toUser, receiver: fromUser },
        ],
    });
    return !!c;
}

/**
 * Process one batch of un-scored reviews. Returns the number processed.
 * Safe to call manually (e.g. from an admin route or a test).
 */
async function runSentimentBatch() {
    // Feature flags: disabled, or no model key → idle (leave sentiment null).
    if (process.env.COSMIC_SENTIMENT_ENABLED === "false") return 0;
    if (!process.env.HUGGINGFACE_API_KEY) {
        console.log("[SentimentWorker] HUGGINGFACE_API_KEY not set — skipping (board uses rating-only fallback).");
        return 0;
    }

    // Reviews with text but no sentiment computed yet.
    const pending = await Rating.find({
        review: { $nin: [null, ""] },
        $or: [{ "sentiment.score": null }, { "sentiment.score": { $exists: false } }],
    })
        .sort({ createdAt: -1 })
        .limit(BATCH_SIZE)
        .select("fromUser toUser review tiedToCompletedSwap")
        .lean();

    if (pending.length === 0) return 0;

    let processed = 0;
    for (const r of pending) {
        try {
            const raw = await mlService.analyzeSentiment(r.review); // -1..1 (0 on failure)
            const update = {
                "sentiment.score": raw,
                "sentiment.label": labelFor(raw),
                "sentiment.model": MODEL_ID,
                "sentiment.computedAt": new Date(),
            };
            // Opportunistically backfill the completed-swap flag (additive).
            if (!r.tiedToCompletedSwap) {
                update.tiedToCompletedSwap = await isTiedToCompletedSwap(r.fromUser, r.toUser);
            }
            await Rating.updateOne({ _id: r._id }, { $set: update });
            processed++;
        } catch (err) {
            console.error("[SentimentWorker] review failed:", err.message);
        }
        await sleep(THROTTLE_MS); // be gentle with the free HF API
    }

    console.log(`[SentimentWorker] processed ${processed}/${pending.length} review(s).`);
    return processed;
}

async function loop() {
    try {
        await runSentimentBatch();
    } catch (err) {
        console.error("[SentimentWorker] batch error:", err);
    }
    setTimeout(loop, INTERVAL_MS);
}

/** Call once from server.js after DB connects. */
function startSentimentWorker() {
    if (process.env.COSMIC_SENTIMENT_ENABLED === "false") {
        console.log("[SentimentWorker] disabled via COSMIC_SENTIMENT_ENABLED=false.");
        return;
    }
    console.log(`[SentimentWorker] scheduled every ${(INTERVAL_MS / 60000).toFixed(0)} min (batch ${BATCH_SIZE}).`);
    setTimeout(loop, 30 * 1000); // first run shortly after boot
}

module.exports = { startSentimentWorker, runSentimentBatch };
