/**
 * PhotonIcon — the Photons currency mark (concept "J · Photon Crystal"): a
 * faceted crystal shard in Orbit's cyan→violet→pink palette. Crisp at 16px
 * (nav chip) and premium at 40px (dashboard/shop).
 *
 * `animated` (default true) adds a PERIODIC "catches-the-light" glow — the
 * crystal is idle most of the cycle, then a halo-pulse + diagonal gloss sweep
 * fires every ~5.5s. Fully reduced-motion safe (honors `prefers-reduced-motion`
 * and the app-wide `[data-anim-off="true"]` switch) — it simply renders static.
 *
 * Gradient ids are per-instance (useId) so multiple icons on one page never
 * collide.
 */
import { useId } from 'react';
import './PhotonIcon.css';

export default function PhotonIcon({ size = 20, animated = true, className = '', title = 'Photons' }) {
  const raw = useId().replace(/[:]/g, '');
  const g1 = `pi-a-${raw}`, g2 = `pi-b-${raw}`, gl = `pi-g-${raw}`, clip = `pi-c-${raw}`;

  return (
    <svg
      width={size} height={size} viewBox="0 0 100 100"
      role="img" aria-label={title}
      className={`photon-icon${animated ? ' photon-icon--anim' : ''}${className ? ' ' + className : ''}`}
    >
      <defs>
        <linearGradient id={g1} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7dd3fc" />
          <stop offset="100%" stopColor="#6d28d9" />
        </linearGradient>
        <linearGradient id={g2} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c084fc" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
        <linearGradient id={gl} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="50%" stopColor="#fff" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <clipPath id={clip}>
          {/* the three facets as one clip shape for the gloss sweep */}
          <path d="M50 10 L68 34 L50 50 L34 34 Z M34 34 L50 50 L42 90 L24 44 Z M68 34 L76 44 L58 90 L50 50 Z" />
        </clipPath>
      </defs>

      {/* faceted crystal */}
      <g stroke="#eaf6ff" strokeWidth="2" strokeLinejoin="round">
        <polygon points="50,10 68,34 50,50 34,34" fill={`url(#${g1})`} />
        <polygon points="34,34 50,50 42,90 24,44" fill={`url(#${g2})`} />
        <polygon points="68,34 76,44 58,90 50,50" fill={`url(#${g1})`} />
      </g>

      {/* periodic diagonal gloss sweep (clipped to the crystal) */}
      {animated && (
        <g clipPath={`url(#${clip})`}>
          <rect className="photon-icon__sweep" x="38" y="-5" width="24" height="110" fill={`url(#${gl})`} />
        </g>
      )}
    </svg>
  );
}
