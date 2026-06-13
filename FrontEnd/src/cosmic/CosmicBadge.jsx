/**
 * CosmicBadge — pure CSS/SVG tier badge for the Cosmic Leaderboard.
 *
 *   <CosmicBadge tierId="pulsar_3" size="full" />   // 57px, animated (profile, Observatory)
 *   <CosmicBadge tierId="moon_2"  size="mini" />    // 20px, static, no filters (lists, chat)
 *
 * Design rules (spec §7):
 *  - Solid bodies (Moon/Planet): outline + drop-shadow, NO glow, NO medallion →
 *    read on white/pastel without any theme-specific code.
 *  - Light-emitters (Star/Pulsar/Supernova/Galaxy/Quasar): rendered inside a
 *    self-contained night-sky medallion so they look IDENTICAL in both themes.
 *  - All <defs> come from the shared BadgeDefsSprite (ID-collision fix, §7.3).
 *  - Mini = static, no blur filters, no star field (smooth list scrolling, §7.2).
 *  - Motion obeys the app Animation Speed via the inherited --anim-speed CSS var
 *    AND prefers-reduced-motion (handled in CosmicBadge.css).
 *  - Within-tier growth (IV→I): body scales up + one visual layer is added.
 *
 * This component is render-only; it never computes a tier from a score.
 */
import { memo } from 'react';
import { getTier, isEmitter } from './tiers';
import './CosmicBadge.css';

const FULL_PX = 57;
const MINI_PX = 20;

// Division → growth scale (IV smallest … I largest). Shared by all categories.
const DIV_SCALE = { 4: 0.84, 3: 0.92, 2: 1.0, 1: 1.08 };

/* small deterministic star field for emitter medallions (full size only) */
const STAR_FIELD = [
  { x: 24, y: 30, r: 0.8, o: 0.7 }, { x: 74, y: 26, r: 0.6, o: 0.5 },
  { x: 80, y: 62, r: 0.7, o: 0.6 }, { x: 30, y: 72, r: 0.5, o: 0.5 },
  { x: 56, y: 18, r: 0.5, o: 0.45 }, { x: 18, y: 54, r: 0.5, o: 0.4 },
];

function Stars({ show }) {
  if (!show) return null;
  return (
    <g className="cb-stars" fill="#FFFFFF">
      {STAR_FIELD.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} opacity={s.o} />
      ))}
    </g>
  );
}

/* ── Medallion backdrop for emitters (shared) ── */
function Medallion() {
  return (
    <>
      <circle cx="50" cy="50" r="48" fill="url(#cb-sky)" />
    </>
  );
}
function MedallionRim({ glow }) {
  return (
    <circle cx="50" cy="50" r="47" fill="none" stroke={`rgb(${glow})`} strokeOpacity="0.35" strokeWidth="1.5" />
  );
}

/* ── Cosmic Sigil frame: a category-material rim + division pips (v2 §3.1) ──
   The rim escalates by category (stone → metal → light → plasma → ember →
   holo → gold). Division pips at N/E/S/W light up as you climb IV→I
   (Moon IV = 1 lit … Moon I = 4 lit; Quasar = all 4). Full size only. */
const PIP_POS = [
  { cx: 50, cy: 6 }, { cx: 94, cy: 50 }, { cx: 50, cy: 94 }, { cx: 6, cy: 50 },
];
function SigilFrame({ category, division, litColor }) {
  const lit = category === 'quasar' ? 4 : Math.max(0, Math.min(4, 5 - division));
  return (
    <>
      <circle cx="50" cy="50" r="47" fill="none" stroke={`url(#cb-rim-${category})`} strokeWidth="3" />
      <g>
        {PIP_POS.map((p, i) => (
          <circle key={i} cx={p.cx} cy={p.cy} r="1.8"
            fill={i < lit ? litColor : '#FFFFFF'}
            opacity={i < lit ? 0.95 : 0.18} />
        ))}
      </g>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────
   Per-category geometry. Each returns the inner <g>/elements.
   `div` is the division (4..1); higher = more layers (within-tier growth).
   `anim` gates animated layers off for mini badges.
───────────────────────────────────────────────────────────── */

function MoonArt({ tier, div }) {
  const s = DIV_SCALE[div];
  const r = 30 * s;
  // crater count grows IV→I
  const craters = [
    { x: 42, y: 40, r: 5 }, { x: 60, y: 58, r: 4 }, { x: 38, y: 62, r: 3 },
    { x: 64, y: 38, r: 2.5 }, { x: 52, y: 52, r: 2 },
  ].slice(0, 1 + (4 - div) + 1);
  return (
    <g filter="url(#cb-drop)">
      <circle cx="50" cy="50" r={r} fill="url(#cb-moon)" stroke="#4A453E" strokeWidth="1.2" />
      <g fill="#6E665B" opacity="0.7">
        {craters.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r={c.r * s} />
        ))}
      </g>
    </g>
  );
}

function PlanetArt({ tier, div }) {
  const s = DIV_SCALE[div];
  const r = 30 * s;
  const fillId =
    tier.body === '#C1440E' ? 'cb-planet-mars' :
    tier.body === '#2B6CB0' ? 'cb-planet-neptune' :
    tier.body === '#D8A47F' ? 'cb-planet-jupiter' : 'cb-planet-mercury';
  return (
    <g filter="url(#cb-drop)">
      {tier.ring && (
        <ellipse cx="50" cy="50" rx={r * 1.5} ry={r * 0.42} fill="none"
          stroke="#E8C09B" strokeOpacity="0.75" strokeWidth="2.2"
          transform="rotate(-20 50 50)" />
      )}
      <circle cx="50" cy="50" r={r} fill={`url(#${fillId})`} stroke="#2A2622" strokeWidth="1.5" />
      {/* Jupiter bands + Great Red Spot */}
      {tier.spot && (
        <>
          <g className="cb-planet-bands" clipPath="none" opacity="0.5" stroke="#9C6E4E" strokeWidth="2" fill="none">
            <path d={`M${50 - r} 44 Q50 40 ${50 + r} 44`} />
            <path d={`M${50 - r} 56 Q50 60 ${50 + r} 56`} />
          </g>
          <ellipse cx="58" cy="55" rx={5 * s} ry={3 * s} fill={tier.spot} opacity="0.85" />
        </>
      )}
      {/* Mars polar cap */}
      {tier.cap && <circle cx="50" cy={50 - r * 0.7} r={4 * s} fill={tier.cap} opacity="0.8" />}
    </g>
  );
}

function StarArt({ tier, div, anim }) {
  const s = DIV_SCALE[div];
  const points = 4 + (4 - div) * 2; // more points IV→I
  const spikes = [];
  for (let i = 0; i < points; i++) {
    const a = (Math.PI * 2 * i) / points;
    const len = 30 * s;
    spikes.push(
      <line key={i} x1="50" y1="50"
        x2={50 + Math.cos(a) * len} y2={50 + Math.sin(a) * len}
        stroke="url(#cb-star-corona)" strokeWidth={i % 2 ? 2 : 3.5} strokeLinecap="round" />
    );
  }
  return (
    <g filter={anim ? 'url(#cb-glow)' : undefined}>
      <circle cx="50" cy="50" r={26 * s} fill="url(#cb-star-corona)" className={anim ? 'cb-pulse' : ''} />
      <g className={anim ? 'cb-flicker' : ''}>{spikes}</g>
      <circle cx="50" cy="50" r={10 * s} fill="url(#cb-star-core)" className={anim ? 'cb-pulse' : ''} />
    </g>
  );
}

function PulsarArt({ tier, div, anim }) {
  const s = DIV_SCALE[div];
  const beamPairs = 1 + (4 - div); // 1..4 beam pairs
  const beams = [];
  for (let i = 0; i < beamPairs; i++) {
    const rot = (180 / beamPairs) * i;
    beams.push(
      <g key={i} transform={`rotate(${rot} 50 50)`}>
        <path d="M50 50 L45.5 7 Q50 3 54.5 7 Z" fill="url(#cb-pulsar-beam)" />
        <path d="M50 50 L45.5 93 Q50 97 54.5 93 Z" fill="url(#cb-pulsar-beam)" />
      </g>
    );
  }
  return (
    <>
      <g className={anim ? 'cb-spin' : ''} filter={anim ? 'url(#cb-glow)' : undefined}
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
        {beams}
      </g>
      <circle cx="50" cy="50" r={6.5 * s} fill="url(#cb-pulsar-core)"
        className={anim ? 'cb-pulse' : ''} filter={anim ? 'url(#cb-glow)' : undefined}
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
    </>
  );
}

function SupernovaArt({ tier, div, anim }) {
  const s = DIV_SCALE[div];
  const rays = 8;
  const spikes = [];
  for (let i = 0; i < rays; i++) {
    const a = (Math.PI * 2 * i) / rays;
    const len = 34 * s;
    spikes.push(
      <line key={i} x1="50" y1="50"
        x2={50 + Math.cos(a) * len} y2={50 + Math.sin(a) * len}
        stroke="url(#cb-supernova-shock)" strokeWidth="4" strokeLinecap="round" />
    );
  }
  return (
    <g filter={anim ? 'url(#cb-glow)' : undefined}>
      {/* shockwave ring grows IV→I */}
      {div <= 2 && <circle cx="50" cy="50" r={40 * s} fill="none" stroke="url(#cb-supernova-shock)" strokeWidth="2" className={anim ? 'cb-shock' : ''} />}
      <g className={anim ? 'cb-flicker' : ''}>{spikes}</g>
      <circle cx="50" cy="50" r={18 * s} fill="url(#cb-supernova)" className={anim ? 'cb-swell' : ''}
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
    </g>
  );
}

function GalaxyArt({ tier, div, anim }) {
  const s = DIV_SCALE[div];
  const arms = 2 + (4 - div); // 2..5 arms
  const armPaths = [];
  for (let i = 0; i < arms; i++) {
    const rot = (360 / arms) * i;
    armPaths.push(
      <path key={i} transform={`rotate(${rot} 50 50)`}
        d="M50 50 C 62 46, 74 52, 78 66 C 70 60, 60 58, 50 60 Z"
        fill="url(#cb-galaxy)" opacity="0.85" />
    );
  }
  return (
    <>
      <g className={anim ? 'cb-spin-slow' : ''} filter={anim ? 'url(#cb-glow)' : undefined}
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
        <ellipse cx="50" cy="50" rx={34 * s} ry={34 * s} fill="url(#cb-galaxy)" opacity="0.12" />
        {armPaths}
      </g>
      <circle cx="50" cy="50" r={8 * s} fill="url(#cb-galaxy)" className={anim ? 'cb-pulse' : ''}
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
      {/* holographic orbiting rim */}
      <circle cx="50" cy="50" r={44 * s} fill="none" stroke="url(#cb-galaxy)" strokeOpacity="0.4"
        strokeWidth="1.2" strokeDasharray="3 5" className={anim ? 'cb-spin' : ''}
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
    </>
  );
}

function QuasarArt({ anim }) {
  return (
    <>
      <rect x="47" y="2" width="6" height="96" fill="url(#cb-quasar-jet)"
        className={anim ? 'cb-jet' : ''} filter={anim ? 'url(#cb-glow)' : undefined} />
      <circle cx="50" cy="50" r="7" fill="url(#cb-quasar-core)"
        className={anim ? 'cb-pulse' : ''} filter={anim ? 'url(#cb-glow)' : undefined}
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
    </>
  );
}

const ART = {
  moon: MoonArt, planet: PlanetArt, star: StarArt,
  pulsar: PulsarArt, supernova: SupernovaArt, galaxy: GalaxyArt,
};

const CosmicBadge = memo(function CosmicBadge({ tierId, size = 'full', className = '', title }) {
  const tier = getTier(tierId);
  const emitter = isEmitter(tier.category);
  const mini = size === 'mini';
  const anim = !mini;                       // mini badges are fully static (§7.2)
  const px = mini ? MINI_PX : FULL_PX;
  const div = tier.division || 1;
  const glow = tier.glow || '127,178,255';

  const Art = tier.category === 'quasar' ? null : ART[tier.category];

  return (
    <span
      className={`cb-badge cb-${tier.category} ${mini ? 'cb-mini' : ''} ${className}`}
      role="img"
      aria-label={tier.displayName}
      title={title ?? (tier.blurb ? `${tier.displayName} — ${tier.blurb}` : tier.displayName)}
      style={{
        width: px, height: px,
        // emitter medallion glow (dark); CSS dials it down in light mode
        '--cb-glow': glow,
      }}
    >
      <svg viewBox="0 0 100 100" className="cb-svg" width={px} height={px}>
        {emitter && <Medallion />}
        {emitter && <Stars show={anim} />}
        {tier.category === 'quasar'
          ? <QuasarArt anim={anim} />
          : <Art tier={tier} div={div} anim={anim} />}
        {emitter && <MedallionRim glow={glow} />}
        {/* Cosmic Sigil frame + division pips — full size only (§3) */}
        {!mini && <SigilFrame category={tier.category} division={div} litColor={`rgb(${glow})`} />}
      </svg>
    </span>
  );
});

export default CosmicBadge;
