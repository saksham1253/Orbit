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

/**
 * track — record an engagement event.
 * @param {string} event  dot-namespaced name, e.g. "streak.graduate"
 * @param {object} [props] structured properties (userId, value, …)
 */
function track(event, props = {}) {
    if (!ENABLED) return;
    try {
        const line = JSON.stringify({ evt: `orbit.${event}`, at: new Date().toISOString(), ...props });
        console.log(`[orbit-analytics] ${line}`);
    } catch (_) {
        /* analytics is best-effort; never affects the request */
    }
}

module.exports = { track };
