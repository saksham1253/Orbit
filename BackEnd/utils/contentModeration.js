/**
 * contentModeration.js — ONE escalating content-policy mechanism for every
 * surface that accepts user-generated text (skill names/descriptions, profile
 * name/bio, …). Previously only skills enforced this, and the logic was
 * duplicated; bio was a soft no-op. Now all callers share this helper so the
 * warning/ban behaviour is identical everywhere.
 *
 * Policy: each violation is a strike (warningCount). On the 3rd strike the
 * account is temporarily banned (bannedUntil) for a window that lengthens with
 * every prior ban (10h, then +5h each time), the strike counter resets, and
 * banCount increments. The existing auth middleware already blocks login while
 * bannedUntil is in the future, so no extra enforcement is needed.
 */
const User = require("../models/user");
const { checkForBannedContent } = require("./bannedKeywords");

const STRIKES_BEFORE_BAN = 3;
const BASE_BAN_HOURS = 10;
const BAN_HOURS_STEP = 5;

/**
 * Scan text and, on a violation, apply the escalating warning/ban policy.
 *
 * @param {string} userId               the acting user's id
 * @param {string|string[]} text        one or more pieces of text to scan together
 * @param {object} [opts]
 * @param {string} [opts.context]       label used in the warning message ("skill", "bio", "profile")
 * @returns {Promise<{ok:boolean, status?:number, body?:object}>}
 *          ok:true  → content is clean, proceed.
 *          ok:false → respond with `status` + `body` (warning 400 or ban 403); do NOT save.
 */
async function enforceContentPolicy(userId, text, opts = {}) {
  const context = opts.context || "content";
  const combined = Array.isArray(text) ? text.filter(Boolean).join(" ") : (text || "");

  const { isClean } = checkForBannedContent(combined);
  if (isClean) return { ok: true };

  const user = await User.findById(userId);
  // If the user can't be loaded we can't escalate; fail safe by blocking the
  // content without a strike rather than silently letting it through.
  if (!user) {
    return {
      ok: false,
      status: 400,
      body: {
        message: "Content contains prohibited terms and cannot be saved.",
        violationType: "content_policy",
        showLargeWarning: true,
      },
    };
  }

  user.warningCount = (user.warningCount || 0) + 1;

  if (user.warningCount >= STRIKES_BEFORE_BAN) {
    const banHours = BASE_BAN_HOURS + (user.banCount || 0) * BAN_HOURS_STEP;
    user.bannedUntil = new Date(Date.now() + banHours * 60 * 60 * 1000);
    user.banCount = (user.banCount || 0) + 1;
    user.warningCount = 0;
    await user.save();

    return {
      ok: false,
      status: 403,
      body: {
        message: `Account temporarily suspended for ${banHours} hours due to repeated community guideline violations.`,
        banned: true,
        timeRemaining: banHours,
        violationType: "content_policy",
        showLargeWarning: true,
      },
    };
  }

  await user.save();
  return {
    ok: false,
    status: 400,
    body: {
      message: `⚠️ WARNING ${user.warningCount}/${STRIKES_BEFORE_BAN}: Your ${context} contains prohibited terms and cannot be saved. Please review our community guidelines.`,
      warningCount: user.warningCount,
      remainingWarnings: STRIKES_BEFORE_BAN - user.warningCount,
      violationType: "content_policy",
      showLargeWarning: true,
    },
  };
}

module.exports = { enforceContentPolicy };
