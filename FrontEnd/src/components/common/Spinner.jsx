import './Spinner.css';

/**
 * Spinner — the inline Orbit loading mark.
 *
 * Variants (use the one that fits the surface):
 *  - 'orbit' → a faint ring with one bright orbiting body. The brand in motion;
 *              best for full-page / route loaders on dark surfaces.
 *  - 'arc'   → a clean monochrome sweep that inherits `currentColor` (stays white
 *              on gradient buttons, themed elsewhere). Best for inline button states.
 *  - 'dual'  → two bodies chasing on one orbit — "the swap". Best for browse /
 *              match content loaders.
 *
 * @param {('orbit'|'arc'|'dual')} variant
 * @param {number} size   px (width = height); border width scales from it.
 * @param {string} label  accessible label (default "Loading").
 */
export default function Spinner({ variant = 'arc', size = 16, className = '', style, label = 'Loading' }) {
  const bw = Math.max(2, Math.round(size / 10));
  return (
    <span
      role="status"
      aria-label={label}
      className={`spinner spinner--${variant} ${className}`}
      style={{ '--sp-size': `${size}px`, '--sp-bw': `${bw}px`, ...style }}
    />
  );
}
