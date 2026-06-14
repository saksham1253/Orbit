/**
 * scoreCopy.js — single source of truth for the user-facing score explainer COPY
 * (deep-spec §4, §4.5). Pure data, no components (kept separate so React Fast
 * Refresh stays happy). Rendered by the helpers in scoreInfo.jsx.
 *
 * IMPORTANT (build note, §4.5): the Trust Score copy mirrors the ACTUAL signals
 * the existing Trust engine uses (calculateTrustScore in trustController.js):
 * average rating received, number of ratings (experience), account age, login
 * activity, minus report/flag penalties. No formula is shown, and nothing here
 * reads, renames, or recomputes Trust logic — display copy only.
 */

// One-line distinction, shown wherever both scores appear together (§4.5).
export const SCORE_DISTINCTION =
  'CosmicScore = how well you teach (your local leaderboard standing). ' +
  'Trust Score = how dependable you are as a member. They’re separate.';

export const COSMIC_TOOLTIP =
  'CosmicScore powers the local leaderboard (built from your reviews, swaps, and activity). It’s separate from your Trust Score.';

export const TRUST_TOOLTIP =
  'Trust Score reflects how reliable you are as a member — your community standing. It’s separate from your CosmicScore.';

// CosmicScore explainer (verbatim from §4.5).
export const COSMIC_SCORE_INFO = {
  title: 'How your CosmicScore works',
  whatItIs:
    'Your CosmicScore (0–100) is your standing on the local leaderboard — how brightly you shine as a mentor in your area. It sets your cosmic tier, from Stardust all the way up to Galaxy, and it’s earned from the quality and consistency of your teaching.',
  howToRaise: [
    'Earn more positive reviews — strong ratings move it the most.',
    'Keep a high average rating across your sessions.',
    'Delight your learners — genuinely enthusiastic, detailed feedback counts for extra.',
    'Complete more skill swaps, not just start them.',
    'Stay active and responsive — be online, reply quickly, and keep a steady teaching rhythm.',
    'Build a track record — more real reviews unlock the higher tiers (Star and above need a minimum number of reviews).',
  ],
  goodToKnow:
    'Recent activity counts more than old activity, so keep teaching to keep climbing. A brand-new mentor starts at the warm-start of 50 (Moon IV) and rises from there.',
};

// Trust Score explainer — aligned to the REAL Trust engine signals (§4.5).
export const TRUST_SCORE_INFO = {
  title: 'How Trust Score works',
  whatItIs:
    'Your Trust Score (0–100) reflects how reliable and well-regarded you are as a SkillSwap member — your standing in the community, separate from your teaching performance on the leaderboard.',
  howToRaise: [
    'Earn strong ratings from the people you swap with — your average rating is the biggest factor.',
    'Build a track record — the more genuine reviews you receive, the more your reliability is established.',
    'Stay active — sign in and keep participating regularly.',
    'Let your account mature — trust grows steadily the longer you’re a member in good standing.',
    'Keep a clean record — avoid reports and flags from other members.',
  ],
};
