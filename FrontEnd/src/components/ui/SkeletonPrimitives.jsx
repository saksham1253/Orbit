import { useEffect } from 'react';

/* ─── Inject @keyframes once ────────────────────────────── */
const inject = () => {
  if (typeof document === 'undefined' || document.getElementById('sk-kf')) return;
  const s = document.createElement('style');
  s.id = 'sk-kf';
  s.textContent = `
    @keyframes skShimmer {
      0%   { background-position: -600px 0; }
      100% { background-position:  600px 0; }
    }
    @keyframes skSpin {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(s);
};

/* ─── Base shimmer style ─────────────────────────────────── */
export const shimmer = (extra = {}) => ({
  background: 'linear-gradient(90deg, var(--skeleton-base) 0%, var(--skeleton-mid) 35%, var(--skeleton-highlight) 50%, var(--skeleton-mid) 65%, var(--skeleton-base) 100%)',
  backgroundSize: '600px 100%',
  animation: 'skShimmer 1.8s ease-in-out infinite',
  flexShrink: 0,
  ...extra,
});

/* ─── SkelBox ───────────────────────────────────────────── */
export const SkelBox = ({ w = '100%', h = 12, r = 6, style = {} }) => {
  useEffect(inject, []);
  return (
    <div
      style={{
        ...shimmer(),
        width: w,
        height: h,
        borderRadius: r,
        ...style,
      }}
    />
  );
};

/* ─── SkelCircle ────────────────────────────────────────── */
export const SkelCircle = ({ size = 44 }) => {
  useEffect(inject, []);
  return (
    <div
      style={{
        ...shimmer(),
        width: size,
        height: size,
        borderRadius: '50%',
        flexShrink: 0,
      }}
    />
  );
};

/* ─── SkelPill ──────────────────────────────────────────── */
export const SkelPill = ({ w = 90, h = 28 }) => {
  useEffect(inject, []);
  return (
    <div
      style={{
        ...shimmer(),
        width: w,
        height: h,
        borderRadius: 999,
        flexShrink: 0,
      }}
    />
  );
};

/* ─── SkelRing — circular gauge ring ───────────────────── */
export const SkelRing = ({ size = 130, stroke = 10 }) => {
  useEffect(inject, []);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: `${stroke}px solid var(--skeleton-mid)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        flexShrink: 0,
      }}
    >
      {/* Center value placeholder */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <SkelBox w={48} h={22} r={4} />
        <SkelBox w={28} h={10} r={4} />
      </div>
      {/* Spinning arc overlay */}
      <div
        style={{
          position: 'absolute',
          inset: -stroke,
          borderRadius: '50%',
          border: `${stroke}px solid transparent`,
          borderTopColor: 'var(--skeleton-highlight)',
          borderRightColor: 'var(--skeleton-highlight)',
          animation: 'skSpin 2s linear infinite',
        }}
      />
    </div>
  );
};

/* ─── SkelProgressBar ───────────────────────────────────── */
export const SkelProgressBar = ({ color = 'var(--skeleton-highlight)', pct = 30 }) => {
  useEffect(inject, []);
  return (
    <div
      style={{
        height: 8,
        background: 'var(--skeleton-base)',
        borderRadius: 999,
        overflow: 'hidden',
        width: '100%',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${pct}%`,
          background: color,
          borderRadius: 999,
          opacity: 0.4,
          ...shimmer(),
        }}
      />
    </div>
  );
};
