/**
 * rarity.js — the SINGLE source of truth for the 15-tier cosmic rarity ladder
 * (Nebula Store). Order = common (1) → ultra-rare (15). Everything that shows a
 * rarity — the card keyword badge, filters/sort, legend, item detail, Holo-Bay —
 * reads from here; never hard-code a label or colour elsewhere.
 *
 * Internal keys are STABLE (safe to reorder display without breaking data).
 * These are RARITY tiers only and are namespaced (`rarity.<key>`) so they never
 * collide with Orbit LEVEL / milestone names.
 *
 * `glow` scales with tier (px halo) so rank reads by intensity, not colour alone
 * — the top tiers additionally glow the whole card (`card`), and MULTIVERSAL is
 * an animated iridescent halo. All treatments are reduced-motion safe (rarity.css).
 */
import './rarity.css';

export const RARITY = Object.freeze({
  LUNAR:         { order: 1,  label: 'Lunar',         color: '#cbd5e1', glow: 7,  card: false, blurb: 'Moonlight — humble, the most common.' },
  STELLAR:       { order: 2,  label: 'Stellar',       color: '#7dd3fc', glow: 11, card: false, blurb: 'A single star.' },
  SOLAR:         { order: 3,  label: 'Solar',         color: '#fbbf24', glow: 13, card: false, blurb: 'A full star and its system.' },
  NEBULAR:       { order: 4,  label: 'Nebular',       color: '#2dd4bf', glow: 14, card: false, blurb: 'A nebula — a star nursery.' },
  ASTRAL:        { order: 5,  label: 'Astral',        color: '#38bdf8', glow: 15, card: false, blurb: 'Ethereal star-field energy.' },
  CELESTIAL:     { order: 6,  label: 'Celestial',     color: '#818cf8', glow: 16, card: false, blurb: 'The heavens as a whole.' },
  GALACTIC:      { order: 7,  label: 'Galactic',      color: '#6366f1', glow: 17, card: false, blurb: 'An entire galaxy.' },
  COSMIC:        { order: 8,  label: 'Cosmic',        color: '#a855f7', glow: 18, card: false, blurb: 'The whole observable cosmos.' },
  HYPERNOVA:     { order: 9,  label: 'Hypernova',     color: '#fb923c', glow: 21, card: true,  blurb: 'The most energetic stellar explosion.' },
  BLACK_HOLE:    { order: 10, label: 'Black Hole',    color: '#0b0d17', glow: 22, card: true,  rim: '#94a3b8', blurb: "Collapsed mass — light can't escape." },
  EVENT_HORIZON: { order: 11, label: 'Event Horizon', color: '#7c3aed', glow: 24, card: true,  blurb: 'The point of no return.' },
  SINGULARITY:   { order: 12, label: 'Singularity',   color: '#ec4899', glow: 30, card: true,  blurb: 'The infinite-density core — most extreme.' },
  DARK_MATTER:   { order: 13, label: 'Dark Matter',   color: '#4c1d95', glow: 33, card: true,  blurb: 'The invisible ~27% of the universe.' },
  ANTIMATTER:    { order: 14, label: 'Antimatter',    color: '#ef4444', glow: 36, card: true,  blurb: 'Mirror of matter — annihilation-grade.' },
  MULTIVERSAL:   { order: 15, label: 'Multiversal',   color: '#a855f7', glow: 40, card: true,  iridescent: true, blurb: 'Beyond a single universe — the ultimate tier.' },
});

// Tiers that ship LIVE at launch (representative low→high subset). The other 10
// stay defined above for later use.
export const LIVE_TIERS = Object.freeze(['LUNAR', 'STELLAR', 'COSMIC', 'HYPERNOVA', 'SINGULARITY']);

const FALLBACK = RARITY.LUNAR;

/** Look up a tier by key (case-insensitive), always returns a valid tier. */
export function rarityOf(key) {
  if (!key) return FALLBACK;
  return RARITY[String(key).toUpperCase()] || FALLBACK;
}

/** Ordered list (low→high) for legends/filters. */
export const RARITY_ORDER = Object.entries(RARITY)
  .sort((a, b) => a[1].order - b[1].order)
  .map(([key, v]) => ({ key, ...v }));

/** Box-shadow string for a rarity's keyword badge (glow scales with tier). */
export function badgeGlow(key) {
  const r = rarityOf(key);
  if (r.iridescent) return `0 0 ${r.glow}px rgba(168,85,247,.85), 0 0 ${r.glow * 0.6}px rgba(236,72,153,.7)`;
  const c = r.color;
  // convert hex → rgba-ish glow via two layered shadows on the tier colour
  return `0 0 ${r.glow}px ${hexA(c, 0.85)}${r.order >= 12 ? `, 0 0 ${r.glow * 0.6}px ${hexA('#a855f7', 0.5)}` : ''}`;
}

/** Inline CSS vars for a rarity — feed into any element using rarity.css classes
 *  (`.rar-badge`, `.rar-card-glow`, `.rar-iridescent`). */
export function rarityVars(key) {
  const r = rarityOf(key);
  return { '--rar': r.color, '--rar-glow': `${r.glow}px` };
}

/** Class name for a card that should carry the tier halo (or '' for low tiers). */
export function cardGlowClass(key) {
  const r = rarityOf(key);
  if (!r.card) return '';
  return r.iridescent ? 'rar-card-glow rar-iridescent' : 'rar-card-glow';
}

// tiny hex→rgba helper (accepts #rrggbb)
function hexA(hex, a) {
  const h = String(hex).replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}
