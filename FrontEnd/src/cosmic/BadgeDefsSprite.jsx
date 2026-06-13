/**
 * BadgeDefsSprite — the single hidden root <svg> holding every gradient/filter
 * used by CosmicBadge. SVG gradient/filter IDs are DOCUMENT-GLOBAL; if each
 * badge defined its own <defs>, duplicate IDs cause blank badges in Safari /
 * Firefox when many render at once (spec §7.3). Defining them ONCE here and
 * referencing by stable id removes that whole class of bug.
 *
 * Mount exactly once near the app root (see App.jsx). aria-hidden + zero-size so
 * it never affects layout, a11y, or the existing dark theme.
 */
import { memo } from 'react';
import { SKY } from './tiers';

const BadgeDefsSprite = memo(function BadgeDefsSprite() {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }}
    >
      <defs>
        {/* ── Shared deep-space medallion backdrop (all emitters) ── */}
        <radialGradient id="cb-sky" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor={SKY.from} />
          <stop offset="70%" stopColor={SKY.mid} />
          <stop offset="100%" stopColor={SKY.to} />
        </radialGradient>

        {/* ── Soft glow filter (emitters) ── */}
        <filter id="cb-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* ── Drop shadow for solid bodies (Moon/Planet) so they read on white ── */}
        <filter id="cb-drop" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodColor="#0D0221" floodOpacity="0.35" />
        </filter>

        {/* ── MOON body ── */}
        <radialGradient id="cb-moon" cx="38%" cy="35%" r="75%">
          <stop offset="0%" stopColor="#A8A096" />
          <stop offset="55%" stopColor="#8D8478" />
          <stop offset="100%" stopColor="#6E665B" />
        </radialGradient>

        {/* ── PLANET bodies (per named planet) ── */}
        <radialGradient id="cb-planet-mercury" cx="38%" cy="35%" r="75%">
          <stop offset="0%" stopColor="#B6B4B1" /><stop offset="60%" stopColor="#9C9A97" /><stop offset="100%" stopColor="#6F6D6A" />
        </radialGradient>
        <radialGradient id="cb-planet-mars" cx="38%" cy="35%" r="75%">
          <stop offset="0%" stopColor="#E0673A" /><stop offset="55%" stopColor="#C1440E" /><stop offset="100%" stopColor="#7E2A06" />
        </radialGradient>
        <radialGradient id="cb-planet-neptune" cx="38%" cy="35%" r="75%">
          <stop offset="0%" stopColor="#4A8FD6" /><stop offset="55%" stopColor="#2B6CB0" /><stop offset="100%" stopColor="#163E6B" />
        </radialGradient>
        <radialGradient id="cb-planet-jupiter" cx="38%" cy="35%" r="75%">
          <stop offset="0%" stopColor="#E8C09B" /><stop offset="55%" stopColor="#D8A47F" /><stop offset="100%" stopColor="#9C6E4E" />
        </radialGradient>

        {/* ── STAR core / corona ── */}
        <radialGradient id="cb-star-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFFFFF" /><stop offset="45%" stopColor="#E8F2FF" /><stop offset="100%" stopColor="#9CC4FF" />
        </radialGradient>
        <radialGradient id="cb-star-corona" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
          <stop offset="40%" stopColor="#BFD9FF" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#7FB2FF" stopOpacity="0" />
        </radialGradient>

        {/* ── PULSAR core / beam ── */}
        <radialGradient id="cb-pulsar-beam" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#E0FBFF" stopOpacity="0.95" />
          <stop offset="28%" stopColor="#7FE1FF" stopOpacity="0.6" />
          <stop offset="65%" stopColor="#4CC9F0" stopOpacity="0.14" />
          <stop offset="100%" stopColor="#4CC9F0" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="cb-pulsar-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFFFFF" /><stop offset="35%" stopColor="#E0FBFF" />
          <stop offset="70%" stopColor="#4CC9F0" /><stop offset="100%" stopColor="#1A6E8E" />
        </radialGradient>

        {/* ── SUPERNOVA burst ── */}
        <radialGradient id="cb-supernova" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFFFFF" /><stop offset="35%" stopColor="#FFD08A" />
          <stop offset="65%" stopColor="#FF6B35" /><stop offset="100%" stopColor="#8B0000" />
        </radialGradient>
        <radialGradient id="cb-supernova-shock" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FF6B35" stopOpacity="0" />
          <stop offset="80%" stopColor="#FF6B35" stopOpacity="0" />
          <stop offset="100%" stopColor="#FFD08A" stopOpacity="0.5" />
        </radialGradient>

        {/* ── GALAXY spiral ── */}
        <radialGradient id="cb-galaxy" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFFFFF" /><stop offset="25%" stopColor="#F6C667" />
          <stop offset="60%" stopColor="#FF8FCF" /><stop offset="100%" stopColor="#9B6BFF" />
        </radialGradient>

        {/* ── QUASAR jet ── */}
        <linearGradient id="cb-quasar-jet" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#8EC5FF" stopOpacity="0" />
          <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#8EC5FF" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="cb-quasar-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFFFFF" /><stop offset="60%" stopColor="#CFE6FF" /><stop offset="100%" stopColor="#8EC5FF" />
        </radialGradient>
      </defs>
    </svg>
  );
});

export default BadgeDefsSprite;
