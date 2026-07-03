/**
 * cosmetics.js — front-end render metadata for Stardust-shop cosmetics.
 * Maps a catalog `key` (owned by the backend) to the CSS class in cosmetics.css
 * plus a small preview swatch. Render-only; the server owns the economy.
 */
import './cosmetics.css';

// key → { glowClass } for name_glow, { bgClass, swatch } for background.
export const COSMETIC_RENDER = {
  glow_aurora: { glowClass: 'cg cg-aurora', swatch: 'linear-gradient(90deg,#5eead4,#10b981)' },
  glow_ember:  { glowClass: 'cg cg-ember',  swatch: 'linear-gradient(90deg,#fdba74,#ef4444)' },
  glow_plasma: { glowClass: 'cg cg-plasma', swatch: 'linear-gradient(90deg,#f0abfc,#8b5cf6)' },
  glow_gold:   { glowClass: 'cg cg-gold',   swatch: 'linear-gradient(90deg,#fde68a,#f59e0b)' },
  glow_void:   { glowClass: 'cg cg-void',   swatch: 'linear-gradient(90deg,#a5b4fc,#f0abfc,#7dd3fc)' },

  bg_nebula_violet: { bgClass: 'cbg cbg-nebula_violet', swatch: 'radial-gradient(circle at 30% 30%,#8b5cf6,#0d0221)' },
  bg_nebula_teal:   { bgClass: 'cbg cbg-nebula_teal',   swatch: 'radial-gradient(circle at 30% 30%,#2dd4bf,#041016)' },
  bg_deep_field:    { bgClass: 'cbg cbg-deep_field',    swatch: 'radial-gradient(circle at 60% 30%,#6366f1,#05070f)' },
  bg_supernova:     { bgClass: 'cbg cbg-supernova',     swatch: 'radial-gradient(circle at 50% 30%,#fbbf24,#0d0402)' },
};

/** CSS class for an equipped name-glow key (or '' if none). */
export function glowClassFor(key) {
  return (key && COSMETIC_RENDER[key] && COSMETIC_RENDER[key].glowClass) || '';
}

/** CSS class for an equipped background key (or '' if none). */
export function bgClassFor(key) {
  return (key && COSMETIC_RENDER[key] && COSMETIC_RENDER[key].bgClass) || '';
}

/** Read equipped cosmetics off a user's orbit sub-doc → { glowClass, bgClass }. */
export function equippedFromUser(user) {
  const c = (user && user.orbit && user.orbit.cosmetics) || {};
  return { glowClass: glowClassFor(c.nameGlow), bgClass: bgClassFor(c.background) };
}
