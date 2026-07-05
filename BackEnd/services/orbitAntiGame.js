/**
 * orbitAntiGame.js — pure anti-gaming core for the Orbit Engine (Part 1 & 2).
 *
 * NO I/O, NO Date.now(). Protects the streak, league XP and currency from cheap
 * message-spam farming (the Snapchat-streak / Duolingo-league failure mode):
 *   - a message earns credit only from a partner not already credited TODAY
 *     (distinct-partner rule);
 *   - only the first N distinct-partner messages/day earn XP (daily taper);
 *   - a weekly per-source cap stops any low-value source dominating a week.
 *
 * Real value (completed swaps & reviews) is never gated here — those always
 * count in full via the caller.
 */

/**
 * qualifyMessage — decide whether a message earns streak/XP credit today.
 *
 * @param {object} msgCredit  { day:"YYYY-MM-DD", partners:[id,...] } (prior state)
 * @param {string} partnerId  the message recipient
 * @param {string} today      "YYYY-MM-DD" UTC
 * @param {object} [opts] { dailyXpCap=3, quality=true }
 * @returns {{ msgCredit, qualifiesForStreak, xpFactor, rank, reason }}
 *   qualifiesForStreak — distinct partner not yet credited today (fallback streak trigger)
 *   xpFactor           — 1 for the first `dailyXpCap` distinct partners, else 0 (taper)
 */
function qualifyMessage(msgCredit, partnerId, today, opts = {}) {
    const dailyXpCap = opts.dailyXpCap ?? 3;
    const quality = opts.quality !== false;

    // Fresh per-day state (resets at the UTC boundary).
    const state = {
        day: (msgCredit && msgCredit.day) || null,
        partners: (msgCredit && Array.isArray(msgCredit.partners)) ? [...msgCredit.partners] : [],
    };
    if (state.day !== today) { state.day = today; state.partners = []; }

    const pid = partnerId != null ? String(partnerId) : null;

    // Quality gate / missing partner → no credit (state's day reset is kept).
    if (!quality) return { msgCredit: state, qualifiesForStreak: false, xpFactor: 0, rank: 0, reason: "low_quality" };
    if (!pid)     return { msgCredit: state, qualifiesForStreak: false, xpFactor: 0, rank: 0, reason: "no_partner" };

    // Already earned credit from this partner today → hollow repeat, no credit.
    if (state.partners.includes(pid)) {
        return { msgCredit: state, qualifiesForStreak: false, xpFactor: 0, rank: 0, reason: "already_credited" };
    }

    // A genuinely new distinct partner today → counts for the (fallback) streak;
    // XP only within the daily cap (tapers to 0 beyond it).
    state.partners.push(pid);
    const rank = state.partners.length;                 // 1-based
    const xpFactor = rank <= dailyXpCap ? 1 : 0;
    return { msgCredit: state, qualifiesForStreak: true, xpFactor, rank, reason: xpFactor ? "full" : "capped" };
}

/**
 * applyWeeklyCap — clamp `amount` XP so a single source can't exceed `cap` this
 * week. Pure; the caller persists the running `total`.
 *
 * @param {number} soFar  XP already granted from this source this week
 * @param {number} amount XP we'd like to add
 * @param {number} cap    weekly ceiling (<=0 → uncapped)
 * @returns {{ granted, total, capped }}
 */
function applyWeeklyCap(soFar, amount, cap) {
    const s = Math.max(0, soFar || 0);
    const a = Math.max(0, amount || 0);
    if (!cap || cap <= 0) return { granted: a, total: s + a, capped: false };
    const room = Math.max(0, cap - s);
    const granted = Math.min(a, room);
    return { granted, total: s + granted, capped: granted < a };
}

module.exports = { qualifyMessage, applyWeeklyCap };
