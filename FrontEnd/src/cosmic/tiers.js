/**
 * tiers.js — canonical front-end tier table for the Cosmic Leaderboard.
 *
 * Render-only metadata: ids, display names, user-facing copy (spec §5.1) and
 * palettes (spec §7.4). The AUTHORITATIVE score→tier thresholds live on the
 * backend (services/cosmicTier.js); this copy never computes a tier from a
 * score, it only renders a tier the API already assigned.
 *
 * Categories: moon, planet (solid bodies — outline + drop-shadow, NO medallion)
 *             star, pulsar, supernova, galaxy, quasar (light-emitters — each
 *             rendered inside its own night-sky medallion so it looks identical
 *             in light and dark themes, spec §7.1).
 */

export const SOLID_CATEGORIES = ['moon', 'planet'];          // no medallion, no glow
export const EMITTER_CATEGORIES = ['star', 'pulsar', 'supernova', 'galaxy', 'quasar'];

export const isEmitter = (category) => EMITTER_CATEGORIES.includes(category);

// Deep-space medallion backdrop (spec §7.1) — shared by every emitter.
export const SKY = { from: '#1A0B2E', mid: '#120726', to: '#0D0221' };

/**
 * Each entry:
 *   tierId, category, division (4=low … 1=high within category),
 *   emoji, name (short, e.g. "The Vela"), displayName ("Pulsar III — The Vela"),
 *   blurb (user-facing description), palette (category render colors),
 *   glow (rgb triplet string for the medallion box-shadow / outline accent).
 */
export const TIERS = {
  // ── 🌑 MOON — "Every journey starts small." ──────────────────────────────
  moon_4: { category: 'moon', division: 4, emoji: '🌑', name: 'The Deimos',
    displayName: 'Moon IV — The Deimos',
    blurb: "You're a tiny moon just beginning to orbit. Every great mentor started exactly here." },
  moon_3: { category: 'moon', division: 3, emoji: '🌑', name: 'The Phobos',
    displayName: 'Moon III — The Phobos',
    blurb: "Small but quick. You're showing up, finding your rhythm, and building momentum." },
  moon_2: { category: 'moon', division: 2, emoji: '🌑', name: 'The Europa',
    displayName: 'Moon II — The Europa',
    blurb: "Smooth and steady. Real potential is forming beneath the surface." },
  moon_1: { category: 'moon', division: 1, emoji: '🌑', name: 'The Titan',
    displayName: 'Moon I — The Titan',
    blurb: "You've grown larger than some planets' worlds. You're ready to become a world yourself." },

  // ── 🪐 PLANET — "You've arrived." ────────────────────────────────────────
  planet_4: { category: 'planet', division: 4, emoji: '🪐', name: 'The Mercury',
    displayName: 'Planet IV — The Mercury',
    blurb: "You're a full world now — small, swift, and real. People can see you clearly.",
    body: '#9C9A97' },
  planet_3: { category: 'planet', division: 3, emoji: '🪐', name: 'The Mars',
    displayName: 'Planet III — The Mars',
    blurb: "A world with seasons and storms. Learners are starting to orbit you.",
    body: '#C1440E', cap: '#FFFFFF' },
  planet_2: { category: 'planet', division: 2, emoji: '🪐', name: 'The Neptune',
    displayName: 'Planet II — The Neptune',
    blurb: "Vast and deep. Your reputation reaches far beyond your own neighborhood.",
    body: '#2B6CB0' },
  planet_1: { category: 'planet', division: 1, emoji: '🪐', name: 'The Jupiter',
    displayName: 'Planet I — The Jupiter',
    blurb: "The king of planets. Your gravity is strong — people orbit you now.",
    body: '#D8A47F', spot: '#9E4A33', ring: true },

  // ── ☀️ STAR — "You generate your own light." ─────────────────────────────
  star_4: { category: 'star', division: 4, emoji: '☀️', name: 'The Sirius',
    displayName: 'Star IV — The Sirius',
    blurb: "You no longer reflect light — you make it. You're the brightest in your area.",
    light: '#A9D6FF', glow: '169,214,255' },
  star_3: { category: 'star', division: 3, emoji: '☀️', name: 'The Vega',
    displayName: 'Star III — The Vega',
    blurb: "A star others measure themselves against. A reliable point of reference.",
    light: '#9CCBFF', glow: '156,203,255' },
  star_2: { category: 'star', division: 2, emoji: '☀️', name: 'The Arcturus',
    displayName: 'Star II — The Arcturus',
    blurb: "You've swelled into a giant. Your influence is impossible to miss.",
    light: '#8CBEFF', glow: '140,190,255' },
  star_1: { category: 'star', division: 1, emoji: '☀️', name: 'The Rigel',
    displayName: 'Star I — The Rigel',
    blurb: "A blinding beacon. People navigate toward you from across the region.",
    light: '#7FB2FF', glow: '127,178,255' },

  // ── 💫 PULSAR — "City-sized, unimaginably dense." ────────────────────────
  pulsar_4: { category: 'pulsar', division: 4, emoji: '💫', name: 'The B1919',
    displayName: 'Pulsar IV — The B1919',
    blurb: "You've become rare and powerful — like the very first pulsar ever discovered.",
    glow: '76,201,240' },
  pulsar_3: { category: 'pulsar', division: 3, emoji: '💫', name: 'The Vela',
    displayName: 'Pulsar III — The Vela',
    blurb: "A lighthouse for your whole city. Your signal reaches everyone.",
    glow: '76,201,240' },
  pulsar_2: { category: 'pulsar', division: 2, emoji: '💫', name: 'The Crab',
    displayName: 'Pulsar II — The Crab',
    blurb: "Relentless energy. You light up everything around you.",
    glow: '76,201,240' },
  pulsar_1: { category: 'pulsar', division: 1, emoji: '💫', name: 'The Magnetar',
    displayName: 'Pulsar I — The Magnetar',
    blurb: "The most powerful kind there is. Your presence bends everything toward you.",
    glow: '124,180,255' },

  // ── 💥 SUPERNOVA — "Brilliant, unmissable." ──────────────────────────────
  supernova_4: { category: 'supernova', division: 4, emoji: '💥', name: 'The 1987A',
    displayName: 'Supernova IV — The 1987A',
    blurb: "You've gone supernova — a rare, dazzling event people stop to watch.",
    glow: '255,107,53' },
  supernova_3: { category: 'supernova', division: 3, emoji: '💥', name: 'The Tycho',
    displayName: 'Supernova III — The Tycho',
    blurb: "So bright the whole community notices you, even in a crowd.",
    glow: '255,107,53' },
  supernova_2: { category: 'supernova', division: 2, emoji: '💥', name: 'The Cassiopeia A',
    displayName: 'Supernova II — The Cassiopeia A',
    blurb: "A fresh, blazing force still growing in power.",
    glow: '255,130,60' },
  supernova_1: { category: 'supernova', division: 1, emoji: '💥', name: 'The Betelgeuse',
    displayName: 'Supernova I — The Betelgeuse',
    blurb: "The one everyone is watching. You're at the edge of legendary.",
    glow: '255,150,70' },

  // ── 🌌 GALAXY — "A universe unto yourself." ──────────────────────────────
  galaxy_4: { category: 'galaxy', division: 4, emoji: '🌌', name: 'The Sombrero',
    displayName: 'Galaxy IV — The Sombrero',
    blurb: "You're no longer a single star — you're a whole system of mentors.",
    glow: '246,198,103' },
  galaxy_3: { category: 'galaxy', division: 3, emoji: '🌌', name: 'The Whirlpool',
    displayName: 'Galaxy III — The Whirlpool',
    blurb: "You draw others in. People want to be in your orbit.",
    glow: '255,143,207' },
  galaxy_2: { category: 'galaxy', division: 2, emoji: '🌌', name: 'The Milky Way',
    displayName: 'Galaxy II — The Milky Way',
    blurb: "A home to countless learners. A true community pillar.",
    glow: '155,107,255' },
  galaxy_1: { category: 'galaxy', division: 1, emoji: '🌌', name: 'The Andromeda',
    displayName: 'Galaxy I — The Andromeda',
    blurb: "The absolute peak — a trillion-star giant. A universe unto yourself.",
    glow: '155,107,255' },

  // ── 🌠 SECRET — The Quasar (off-ladder) ──────────────────────────────────
  quasar: { category: 'quasar', division: 0, emoji: '🌠', name: 'The Quasar',
    displayName: 'The Quasar',
    blurb: "Beyond the ladder. Only retired #1 city champions become a Quasar — the brightest thing in the known universe, shining forever in the Legends Archive.",
    glow: '142,197,255' },
};

// Ordered list (low → high) for galleries / progress UIs.
export const TIER_ORDER = [
  'moon_4', 'moon_3', 'moon_2', 'moon_1',
  'planet_4', 'planet_3', 'planet_2', 'planet_1',
  'star_4', 'star_3', 'star_2', 'star_1',
  'pulsar_4', 'pulsar_3', 'pulsar_2', 'pulsar_1',
  'supernova_4', 'supernova_3', 'supernova_2', 'supernova_1',
  'galaxy_4', 'galaxy_3', 'galaxy_2', 'galaxy_1',
  'quasar',
];

export const getTier = (tierId) => TIERS[tierId] || TIERS.moon_4;
