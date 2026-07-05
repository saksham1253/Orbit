/**
 * orbitAnalytics.js — lightweight structured event emitter (Part 8).
 *
 * Emits one JSON line per engagement event so each tier's impact is measurable
 * (streak start/break/graduate, mission claim, Photons earn/spend, league
 * promote/relegate, Binary Star create/dissolve, cosmetic purchase, ritual
 * completion, push delivered/opened). The sink is intentionally pluggable: by
 * default it writes a `[orbit-analytics] {json}` line to stdout (ingestable by
 * any log pipeline); set ORBIT_ANALYTICS=false to silence. Never throws.
 */

const ENABLED = String(process.env.ORBIT_ANALYTICS).toLowerCase() !== "false";

// In-memory ring buffer so the Telemetry stream (Mission Control C7) can tail
// recent events without a persistence layer. Bounded so it never leaks memory.
const RING_MAX = 1000;
const RING = [];

/**
 * track — record an engagement event.
 * @param {string} event  dot-namespaced name, e.g. "streak.graduate"
 * @param {object} [props] structured properties (userId, value, …)
 */
function track(event, props = {}) {
    if (!ENABLED) return;
    try {
        const rec = { evt: `orbit.${event}`, at: new Date().toISOString(), ...props };
        console.log(`[orbit-analytics] ${JSON.stringify(rec)}`);
        RING.push(rec);
        if (RING.length > RING_MAX) RING.shift();
    } catch (_) {
        /* analytics is best-effort; never affects the request */
    }
}

/** Recent events (newest first), optionally filtered by event-prefix / userId. */
function recent({ limit = 100, evt, userId } = {}) {
    let out = RING;
    if (evt) out = out.filter((r) => r.evt.includes(evt));
    if (userId) out = out.filter((r) => String(r.userId) === String(userId));
    return out.slice(-limit).reverse();
}

/** Aggregate counts per event type (for the per-tier funnel charts, C7/C8). */
function funnels() {
    const counts = {};
    for (const r of RING) counts[r.evt] = (counts[r.evt] || 0) + 1;
    return counts;
}

module.exports = { track, recent, funnels };
