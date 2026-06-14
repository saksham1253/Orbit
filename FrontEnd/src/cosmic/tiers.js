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

export const SOLID_CATEGORIES = ['asteroid', 'meteor', 'stardust', 'moon', 'planet']; // no medallion, no glow
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
  // ── THE DESCENT (below Moon — recovery tiers, v4 §2) ─────────────────────
  asteroid_1: { category: 'asteroid', division: 1, name: 'The Ceres',
    displayName: 'Asteroid I — The Ceres',
    blurb: 'The largest of the wanderers — almost a moon. One good orbit and you round into one.' },
  asteroid_2: { category: 'asteroid', division: 2, name: 'The Vesta',
    displayName: 'Asteroid II — The Vesta',
    blurb: 'A bright, solid rock. You have real mass; gather a little more.' },
  asteroid_3: { category: 'asteroid', division: 3, name: 'The Pallas',
    displayName: 'Asteroid III — The Pallas',
    blurb: 'Tumbling but intact. Find your rhythm and rise.' },
  asteroid_4: { category: 'asteroid', division: 4, name: 'The Hygiea',
    displayName: 'Asteroid IV — The Hygiea',
    blurb: 'Dark and quiet, but whole. The climb starts here.' },

  meteor_1: { category: 'meteor', division: 1, name: 'The Perseid',
    displayName: 'Meteor I — The Perseid',
    blurb: 'A bright streak across the sky — brief, but everyone looks up.' },
  meteor_2: { category: 'meteor', division: 2, name: 'The Geminid',
    displayName: 'Meteor II — The Geminid',
    blurb: 'A steady fall with real fire. Turn the descent into momentum.' },
  meteor_3: { category: 'meteor', division: 3, name: 'The Leonid',
    displayName: 'Meteor III — The Leonid',
    blurb: 'A flicker in the dark. Small, but still burning.' },
  meteor_4: { category: 'meteor', division: 4, name: 'The Orionid',
    displayName: 'Meteor IV — The Orionid',
    blurb: 'A faint trail. Keep moving — even falling things can rise.' },

  stardust_1: { category: 'stardust', division: 1, name: 'The Zodiac',
    displayName: 'Stardust I — The Zodiac',
    blurb: "Scattered light along the ecliptic. You're catching the sun again." },
  stardust_2: { category: 'stardust', division: 2, name: 'The Oort',
    displayName: 'Stardust II — The Oort',
    blurb: 'Far out in the cold, drifting. The long way back begins.' },
  stardust_3: { category: 'stardust', division: 3, name: 'The Scatter',
    displayName: 'Stardust III — The Scatter',
    blurb: 'Flung wide and thin. Gather yourself.' },
  stardust_4: { category: 'stardust', division: 4, name: 'The Spark',
    displayName: 'Stardust IV — The Spark',
    blurb: 'A single faint ember in the dark. Every moon, planet, and star was once dust like this. Begin again.' },

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
  'stardust_4', 'stardust_3', 'stardust_2', 'stardust_1',
  'meteor_4', 'meteor_3', 'meteor_2', 'meteor_1',
  'asteroid_4', 'asteroid_3', 'asteroid_2', 'asteroid_1',
  'moon_4', 'moon_3', 'moon_2', 'moon_1',
  'planet_4', 'planet_3', 'planet_2', 'planet_1',
  'star_4', 'star_3', 'star_2', 'star_1',
  'pulsar_4', 'pulsar_3', 'pulsar_2', 'pulsar_1',
  'supernova_4', 'supernova_3', 'supernova_2', 'supernova_1',
  'galaxy_4', 'galaxy_3', 'galaxy_2', 'galaxy_1',
  'quasar',
];

// ── Per-division core palettes (v3 §4.2) ───────────────────────────────────
// Every one of the 24 divisions gets a DISTINCT core color so the four Moons,
// four Stars, four Supernovas, etc. are instantly distinguishable side-by-side.
// `core` drives the celestial body; `accent` is a secondary feature tint.
export const DIVISION_COLORS = {
  // ── The Descent (v4 §2.3) ──
  asteroid_1: { core: '#8A8178', accent: '#B5ACA0' }, // Ceres light stony grey
  asteroid_2: { core: '#9B8463', accent: '#C7A877' }, // Vesta tan-brown, basaltic patch
  asteroid_3: { core: '#5A5048', accent: '#3E3833' }, // Pallas dark carbon, pitted
  asteroid_4: { core: '#6E6A66', accent: '#8E8A85' }, // Hygiea iron metallic
  meteor_1: { core: '#7A6E64', accent: '#FF9E5A' },   // Perseid + orange rim
  meteor_2: { core: '#564E47', accent: '#E08A3C' },   // Geminid + amber
  meteor_3: { core: '#4A5560', accent: '#6FB0C8' },   // Leonid + faint cyan
  meteor_4: { core: '#3E3A38', accent: '#8A5A3C' },   // Orionid + dim ember
  stardust_1: { core: '#9FB3C8', accent: '#CFE0EE' }, // Zodiac pale blue-grey motes
  stardust_2: { core: '#8B7FA8', accent: '#B6A8D0' }, // Oort muted violet
  stardust_3: { core: '#6B6B72', accent: '#9A9AA2' }, // Scatter dim grey
  stardust_4: { core: '#3A363B', accent: '#FFB36B' }, // Spark near-black + one ember

  moon_4: { core: '#5C5650', accent: '#3E3A35' },   // basalt grey, heavy craters
  moon_3: { core: '#7A6F60', accent: '#564E42' },   // red-dust grey, regolith streaks
  moon_2: { core: '#CFE8F0', accent: '#7FB0C8' },   // icy blue-white, ice cracks
  moon_1: { core: '#C9A24B', accent: '#E0B85F' },   // golden haze, orange atmosphere

  planet_4: { core: '#9C9A97', accent: '#6F6D6A' }, // Mercury grey
  planet_3: { core: '#C1440E', accent: '#FFFFFF' }, // Mars rust + polar cap
  planet_2: { core: '#2B6CB0', accent: '#A9D6FF' }, // Neptune blue + cloud bands
  planet_1: { core: '#D8A47F', accent: '#9E4A33' }, // Jupiter tan + red spot

  star_4: { core: '#BCD8FF', accent: '#E8F2FF' },   // Sirius blue-white
  star_3: { core: '#F4F4FF', accent: '#FFFFFF' },   // Vega pure white
  star_2: { core: '#FFB36B', accent: '#FFD9A8' },   // Arcturus amber giant
  star_1: { core: '#9DB8FF', accent: '#CFE0FF' },   // Rigel bright blue

  pulsar_4: { core: '#7FE1FF', accent: '#BFF2FF' }, // pale cyan, slow single sweep
  pulsar_3: { core: '#4CC9F0', accent: '#7FE1FF' }, // cyan twin beams
  pulsar_2: { core: '#43E0C0', accent: '#9BF0DF' }, // teal-green, fast beams
  pulsar_1: { core: '#B36BFF', accent: '#D6B0FF' }, // violet-magenta, field arcs

  supernova_4: { core: '#FF6B35', accent: '#8B0000' }, // red→orange, single shock
  supernova_3: { core: '#FFB000', accent: '#C2410C' }, // orange→gold, double shock
  supernova_2: { core: '#43E0C0', accent: '#0E7C66' }, // teal-green shock + filaments
  supernova_1: { core: '#FF7043', accent: '#B11226' }, // crimson→coral, big swell

  galaxy_4: { core: '#F6C667', accent: '#C99A3F' },  // Sombrero gold edge-on
  galaxy_3: { core: '#8FB8FF', accent: '#FFFFFF' },  // Whirlpool blue-white
  galaxy_2: { core: '#E8D9B5', accent: '#9E7B4F' },  // Milky Way cream
  galaxy_1: { core: '#C77DFF', accent: '#FF8FCF' },  // Andromeda violet-pink

  quasar: { core: '#FFFFFF', accent: '#8EC5FF' },
};
export const divisionColor = (tierId) => DIVISION_COLORS[tierId] || DIVISION_COLORS.moon_4;

export const getTier = (tierId) => TIERS[tierId] || TIERS.moon_4;

// Entry score (core) per tier — mirrors backend TIER_FLOORS (v2 §2.2.1).
export const TIER_FLOORS = {
  stardust_4: 0.0, stardust_3: 6.0, stardust_2: 12.0, stardust_1: 18.0,
  meteor_4: 24.0, meteor_3: 30.0, meteor_2: 35.0, meteor_1: 39.0,
  asteroid_4: 42.0, asteroid_3: 45.0, asteroid_2: 47.0, asteroid_1: 48.5,
  moon_4: 50.0, moon_3: 53.0, moon_2: 56.0, moon_1: 59.0,
  planet_4: 62.0, planet_3: 65.0, planet_2: 68.0, planet_1: 71.0,
  star_4: 74.0, star_3: 77.0, star_2: 80.0, star_1: 82.5,
  pulsar_4: 85.0, pulsar_3: 87.0, pulsar_2: 89.0, pulsar_1: 91.0,
  supernova_4: 93.0, supernova_3: 94.5, supernova_2: 96.0, supernova_1: 97.0,
  galaxy_4: 98.0, galaxy_3: 98.7, galaxy_2: 99.3, galaxy_1: 99.7,
};

const LADDER_IDS = TIER_ORDER.filter((id) => id !== 'quasar');

/** CosmicScore range "X – Y" for a tier (Galaxy I → "99.7 – 100"). */
export const scoreRange = (tierId) => {
  const i = LADDER_IDS.indexOf(tierId);
  if (i < 0) return null;
  const lo = TIER_FLOORS[tierId];
  const hi = i < LADDER_IDS.length - 1 ? TIER_FLOORS[LADDER_IDS[i + 1]] : 100;
  return { lo, hi };
};

// Eligibility requirement per category (v2 §2.2 / §6.6).
const CATEGORY_REQ = {
  moon: '', planet: '',
  star: 'Requires ≥ 8 weighted reviews',
  pulsar: 'Requires ≥ 20 weighted reviews',
  supernova: 'Requires ≥ 20 weighted reviews',
  galaxy: 'Requires ≥ 50 weighted reviews + 1 full season',
  quasar: 'Awarded only to retired #1 city champions',
};
export const tierRequirement = (tierId) => CATEGORY_REQ[(TIERS[tierId] || {}).category] || '';

// Perks unlocked, by category (v2 §6).
const CATEGORY_PERKS = {
  stardust: ['Every mentor starts as dust — the climb begins here', 'Fully ranked on the local board'],
  meteor: ['Still on the board, still climbing', 'A warmer badge as you rise'],
  asteroid: ['Almost a Moon — one good orbit away', 'Ranked alongside everyone'],
  moon: ['Cosmic badge on your profile', 'A place on the local leaderboard'],
  planet: ['Larger, detailed planet badge', 'Climb the local board'],
  star: ['Light-emitter badge with glow', 'Earned titles begin'],
  pulsar: ['Animated pulsar badge', 'Stronger leaderboard presence'],
  supernova: ['Name-glow perk begins (warm halo)', 'Eligible for Supernova of the Month'],
  galaxy: ['Animated gradient name-glow', 'Community-pillar status', 'Observatory prominence'],
  quasar: ['Legendary pulsing name-glow', 'Permanent star in the Legends Archive', 'Brightest object in the known universe'],
};
export const tierPerks = (tierId) => CATEGORY_PERKS[(TIERS[tierId] || {}).category] || [];

/** Name-glow tier (v2 §8): only Supernova+ glow; null below. */
export const nameGlowFor = (tierId) => {
  const cat = (TIERS[tierId] || {}).category;
  if (cat === 'quasar') return 'quasar';
  if (cat === 'galaxy') return 'galaxy';
  if (cat === 'supernova') return 'supernova';
  return null;
};
