/**
 * momentCopy — shared copy/logic for rank moments (v7 §6).
 *
 * Kept separate from RankMomentCard so the component file only exports a
 * component (react-refresh) while the overlay and admin Moment Lab can reuse
 * the same promotion test and wording.
 */
import { getTier, TIER_ORDER } from './tiers';

const idx = (tierId) => TIER_ORDER.indexOf(tierId);

/** Category jump upward → the grand "Liftoff" treatment (vs a within-tier rank-up). */
export function isPromotion(fromId, toId) {
  if (!fromId) return getTier(toId).category !== 'moon';
  return getTier(fromId).category !== getTier(toId).category && idx(toId) > idx(fromId);
}

/**
 * Copy for a moment — { eyebrow, support }. The tier NAME is rendered separately
 * (as the headline), so `support` never repeats it.
 */
export function momentCopy({ variant, tierId, fromTierId, pointsToRecover, city }) {
  const t = getTier(tierId);
  const where = city ? ` over ${city}'s sky` : '';

  if (variant === 'down') {
    const recover = pointsToRecover != null && fromTierId
      ? ` You need +${pointsToRecover} to return to ${getTier(fromTierId).displayName}.`
      : '';
    return {
      eyebrow: 'A QUIET DESCENT · STILL BURNING',
      support: `Stars flicker — climb back.${recover}`,
    };
  }

  const promotion = variant === 'quasar' || isPromotion(fromTierId, tierId);
  const mode = variant === 'quasar' || promotion ? 'LIFTOFF' : 'RANK UP';
  const byCat = {
    stardust:  ['A SPARK CATCHES',     "You're gathering light again."],
    meteor:    ['STILL ON FIRE',       "You're rising."],
    asteroid:  ['GATHERING MASS',      'Almost a world again.'],
    moon:      ['BACK IN ORBIT',       "You've gathered enough mass to hold an orbit again."],
    planet:    ['A WORLD IS BORN',     'A new world is born.'],
    star:      ['IGNITION',            'You now generate your own light.'],
    pulsar:    ['A LIGHTHOUSE RISES',  `You're a pulsar${where}.`],
    supernova: ['SUPERNOVA',           'The whole community is watching.'],
    galaxy:    ['ANDROMEDA CLASS',     'A universe unto yourself.'],
    quasar:    ['BEYOND THE LADDER',   'Shining forever — the brightest thing in the known universe.'],
  };
  const [kicker, support] = byCat[t.category] || ["YOU'VE GROWN", 'Welcome to your new tier.'];
  return { eyebrow: `${mode} · ${kicker}`, support };
}
