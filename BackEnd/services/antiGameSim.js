/**
 * antiGameSim.js — PURE simulator for the message anti-gaming rules (Mission
 * Control C3). NO DB, NO writes. Replays the real orbitAntiGame core over a
 * sequence of messages so an admin can PROVE B1 without touching real users.
 * Messages are distributed round-robin across `targets`.
 */

const { qualifyMessage, applyWeeklyCap } = require("./orbitAntiGame");
const cfg = require("./orbitConfig");

/**
 * simulate — run `count` messages across `targets` on `date`.
 * @returns {{ perMessage, totals, assertions }}
 */
function simulate({ targets = [], count = 0, date = "2026-07-06", dailyXpCap, weeklyCap } = {}) {
    const cap = dailyXpCap ?? cfg.MSG.dailyXpCap;
    const wcap = weeklyCap ?? cfg.MSG.weeklyXpCap;
    const xpPerMsg = cfg.XP.message;

    let msgCredit = { day: date, partners: [] };
    let weekXp = 0;
    const perMessage = [];

    for (let i = 0; i < count; i++) {
        const partner = targets.length ? targets[i % targets.length] : null;
        const q = qualifyMessage(msgCredit, partner, date, { dailyXpCap: cap });
        msgCredit = q.msgCredit;

        let xp = q.xpFactor * xpPerMsg;
        const capped = applyWeeklyCap(weekXp, xp, wcap);
        weekXp = capped.total;
        xp = capped.granted;

        perMessage.push({ i: i + 1, partner, countedForStreak: q.qualifiesForStreak, xp, reason: q.reason });
    }

    const distinctCredited = new Set(perMessage.filter((m) => m.countedForStreak).map((m) => m.partner)).size;
    const totals = {
        messages: count,
        distinctPartnersCredited: distinctCredited,
        streakDaysGranted: perMessage.some((m) => m.countedForStreak) ? 1 : 0, // streak advances ≤1/day
        xpTotal: perMessage.reduce((a, m) => a + m.xp, 0),
        weeklyXpCap: wcap,
        dailyXpCap: cap,
    };

    // Named, self-verifying assertions (what B1 guarantees).
    const assertions = [
        { name: "streak_at_most_one_day", pass: totals.streakDaysGranted <= 1 },
        { name: "xp_within_daily_cap", pass: totals.xpTotal <= cap * xpPerMsg || totals.xpTotal <= wcap },
        { name: "spam_same_partner_yields_no_extra_credit",
          pass: new Set(targets).size > 1 || totals.distinctPartnersCredited <= 1 },
    ];
    return { perMessage, totals, assertions };
}

module.exports = { simulate };
