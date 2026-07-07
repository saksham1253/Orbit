/**
 * itemIcons.jsx — hand-built SVG icons for Nebula Store items. NO emojis, NO
 * icon-font — every mark is a real vector so it stays crisp at any size and can
 * carry the item's rarity colour. Each icon takes { size, color } and uses a
 * per-instance gradient id (useId) so multiple copies on one page never collide.
 *
 * Lookup order in <ItemIcon>: exact catalog `key` → item `type` → item
 * `category` → a generic sparkle. So a brand-new backend item still renders a
 * sensible mark before it ever gets a bespoke one.
 */
import { useId } from 'react';

const box = (size) => ({ width: size, height: size, viewBox: '0 0 48 48', fill: 'none', xmlns: 'http://www.w3.org/2000/svg' });

// ── name-glow: a glowing capital "A" wrapped in an aura ──────────────────────
function GlyphGlow({ size = 40, color = '#a855f7' }) {
  const g = useId();
  return (
    <svg {...box(size)} aria-hidden="true">
      <defs>
        <radialGradient id={g} cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor={color} stopOpacity="0.9" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="24" cy="22" r="18" fill={`url(#${g})`} />
      <path d="M16 34 L24 12 L32 34 M19 27 H29" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

// ── background / theme: a nebula disc with drifting star specks ───────────────
function NebulaDisc({ size = 40, color = '#8b5cf6' }) {
  const g = useId();
  return (
    <svg {...box(size)} aria-hidden="true">
      <defs>
        <radialGradient id={g} cx="38%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.9" />
          <stop offset="35%" stopColor={color} />
          <stop offset="100%" stopColor="#05070f" />
        </radialGradient>
      </defs>
      <circle cx="24" cy="24" r="17" fill={`url(#${g})`} stroke={color} strokeOpacity="0.5" />
      <circle cx="17" cy="18" r="1.1" fill="#fff" />
      <circle cx="31" cy="16" r="0.9" fill="#fff" />
      <circle cx="33" cy="30" r="1.1" fill="#fff" />
      <circle cx="19" cy="31" r="0.8" fill="#fff" />
    </svg>
  );
}

// ── avatar frame: a hex frame ring ───────────────────────────────────────────
function FrameRing({ size = 40, color = '#fb923c' }) {
  return (
    <svg {...box(size)} aria-hidden="true">
      <path d="M24 5 L39 14 V32 L24 41 L9 32 V14 Z" stroke={color} strokeWidth="2.4" fill="none" />
      <path d="M24 12 L33 17 V29 L24 34 L15 29 V17 Z" stroke={color} strokeOpacity="0.4" strokeWidth="1.6" fill="none" />
    </svg>
  );
}

// ── cursor: a comet-tailed pointer ───────────────────────────────────────────
function CometCursor({ size = 40, color = '#a855f7' }) {
  const g = useId();
  return (
    <svg {...box(size)} aria-hidden="true">
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M12 10 L30 20 L22 22 L20 30 Z" fill={color} />
      <path d="M30 20 L42 8" stroke={`url(#${g})`} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// ── title / banner: a ribbon plate ───────────────────────────────────────────
function Ribbon({ size = 40, color = '#38bdf8' }) {
  return (
    <svg {...box(size)} aria-hidden="true">
      <path d="M8 16 H40 V28 L34 24 H14 L8 28 Z" fill={color} fillOpacity="0.18" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <path d="M15 22 H33" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// ── power-up / booster: a lightning-charged ring ─────────────────────────────
function BoosterBolt({ size = 40, color = '#fbbf24' }) {
  const g = useId();
  return (
    <svg {...box(size)} aria-hidden="true">
      <defs>
        <radialGradient id={g} cx="50%" cy="50%" r="55%">
          <stop offset="0%" stopColor={color} stopOpacity="0.5" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="24" cy="24" r="18" fill={`url(#${g})`} />
      <path d="M26 8 L14 26 H23 L20 40 L34 20 H25 Z" fill={color} stroke={color} strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

// ── bundle: stacked gift/crate ───────────────────────────────────────────────
function Bundle({ size = 40, color = '#ec4899' }) {
  return (
    <svg {...box(size)} aria-hidden="true">
      <rect x="10" y="18" width="28" height="20" rx="2" stroke={color} strokeWidth="2.2" fill={color} fillOpacity="0.12" />
      <path d="M10 24 H38 M24 18 V38" stroke={color} strokeWidth="2" />
      <path d="M24 18 C20 12 14 12 16 18 M24 18 C28 12 34 12 32 18" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// ── generic fallback: a four-point sparkle ───────────────────────────────────
function Sparkle({ size = 40, color = '#a855f7' }) {
  return (
    <svg {...box(size)} aria-hidden="true">
      <path d="M24 8 C25 18 30 23 40 24 C30 25 25 30 24 40 C23 30 18 25 8 24 C18 23 23 18 24 8 Z" fill={color} fillOpacity="0.85" />
    </svg>
  );
}

// key/type/category → component
const BY_KEY = {};
const BY_TYPE = {
  name_glow: GlyphGlow,
  background: NebulaDisc,
  avatar_frame: FrameRing,
  cursor: CometCursor,
  title: Ribbon,
  banner: Ribbon,
  power_up: BoosterBolt,
  bundle: Bundle,
};
const BY_CATEGORY = {
  identity: GlyphGlow,
  themes: NebulaDisc,
  frames: FrameRing,
  effects: CometCursor,
  boosts: BoosterBolt,
  bundles: Bundle,
};

/** Resolve the best custom SVG for a store item and render it in the tier colour. */
export default function ItemIcon({ item = {}, size = 40, color }) {
  const Cmp = BY_KEY[item.key] || BY_TYPE[item.type] || BY_CATEGORY[item.category] || Sparkle;
  return <Cmp size={size} color={color || '#a855f7'} />;
}

export { GlyphGlow, NebulaDisc, FrameRing, CometCursor, Ribbon, BoosterBolt, Bundle, Sparkle };
