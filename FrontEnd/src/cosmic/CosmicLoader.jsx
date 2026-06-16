/**
 * CosmicLoader — themed loading experience for the Leaderboard scopes and the
 * Observatory (v5 §5). Replaces the raw `animate-pulse` blocks with rotating
 * "cosmic thoughts" over a faint drifting starfield.
 *
 * Behavior (v5 §5):
 *  - Cycles a randomized set of messages every ~1.5s with a gentle cross-fade.
 *  - Anti-flash: renders nothing for the first 400ms so quick loads never blink.
 *  - Slow-load reassurance: after ~6s a calm "still exploring…" line + optional
 *    Retry (only shown when an `onRetry` handler is provided).
 *  - Reduced-motion / Animation Speed = 0 → static text, no drifting starfield.
 *  - A11y: role="status" aria-live="polite" announces the current thought.
 *
 * Pure CSS/JS — no canvas, no new dependencies. The starfield uses only
 * transform/opacity so it stays GPU-cheap and theme-agnostic.
 */
import { useEffect, useMemo, useState } from 'react';
import { Telescope, Compass, RotateCw } from 'lucide-react';
import useAppearanceStore from '../store/appearanceStore';

const LEADERBOARD_THOUGHTS = [
  'Exploring the cosmos…',
  'Charting your local sky…',
  'Measuring starlight…',
  'Aligning the constellations…',
  'Calibrating cosmic ranks…',
  'Gathering stardust…',
  'Locating mentors in your orbit…',
];

const OBSERVATORY_THOUGHTS = [
  'Powering up the great telescope…',
  'Focusing on the brightest stars…',
  'Tracing the path to the North Star…',
  'Listening for distant pulsars…',
  'Sweeping the night sky for legends…',
  'Catching a supernova mid-burst…',
  'Mapping orbits around the North Star…',
  'Tuning into cosmic frequencies…',
  'Polishing the observatory lens…',
  'Counting photons from light-years away…',
  'Unfolding the star charts…',
  'Waiting for the clouds to clear…',
];

// Deterministic shuffle seeded by an integer — avoids Math.random so the order
// is stable for a given mount but still feels varied between mounts (the seed
// derives from the thought count + a per-mount tick).
function shuffle(list, seed) {
  const a = [...list];
  let s = seed || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// A small deterministic star field (percentage coords) for the drifting backdrop.
const STARS = [
  { x: 12, y: 22, r: 1.4, d: 0 }, { x: 78, y: 16, r: 1.0, d: 0.6 },
  { x: 64, y: 64, r: 1.6, d: 1.2 }, { x: 26, y: 74, r: 1.1, d: 0.9 },
  { x: 88, y: 48, r: 1.2, d: 0.3 }, { x: 44, y: 34, r: 0.9, d: 1.5 },
  { x: 8, y: 54, r: 1.0, d: 0.7 }, { x: 54, y: 12, r: 1.3, d: 1.1 },
  { x: 36, y: 88, r: 1.0, d: 0.4 }, { x: 70, y: 84, r: 0.8, d: 1.3 },
];

export default function CosmicLoader({ variant = 'leaderboard', onRetry, className = '' }) {
  const getSpeed = useAppearanceStore((s) => s.getSpeedMultiplier);
  const speed = getSpeed ? getSpeed() : 1;
  const reduced = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  );
  const still = reduced || speed === 0;

  const isObservatory = variant === 'observatory';
  const base = isObservatory ? OBSERVATORY_THOUGHTS : LEADERBOARD_THOUGHTS;
  const Icon = isObservatory ? Telescope : Compass;

  // Anti-flash: don't paint anything for the first 400ms.
  const [show, setShow] = useState(false);
  // Rotating message index, slow-load flag.
  const [idx, setIdx] = useState(0);
  const [slow, setSlow] = useState(false);
  // Re-shuffle order each mount via a tick that only advances on the timer.
  const [tick, setTick] = useState(1);
  const thoughts = useMemo(() => shuffle(base, base.length * 7 + tick), [base, tick]);

  useEffect(() => {
    const showTimer = setTimeout(() => setShow(true), 400);
    const slowTimer = setTimeout(() => setSlow(true), 6000);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(slowTimer);
    };
  }, []);

  // Rotate messages every ~1.5s once visible.
  useEffect(() => {
    if (!show) return;
    const period = 1500;
    const t = setInterval(() => {
      setIdx((i) => {
        const next = i + 1;
        if (next >= thoughts.length) {
          setTick((k) => k + 1); // reshuffle for the next pass
          return 0;
        }
        return next;
      });
    }, period);
    return () => clearInterval(t);
  }, [show, thoughts.length]);

  if (!show) return null;

  const message = thoughts[idx] || base[0];
  const heightClass = isObservatory ? 'min-h-[560px]' : 'min-h-[320px]';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`relative overflow-hidden rounded-2xl flex flex-col items-center justify-center text-center px-6 ${heightClass} ${className}`}
      style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}
    >
      {/* Drifting starfield backdrop (transform/opacity only). Static when reduced. */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {!still && (
          <style>{`
            @keyframes ssLoaderTwinkle { 0%,100% { opacity: 0.25; transform: scale(1); } 50% { opacity: 0.85; transform: scale(1.35); } }
            @keyframes ssLoaderDrift { from { transform: translateY(0); } to { transform: translateY(-8px); } }
          `}</style>
        )}
        <div
          style={
            still
              ? undefined
              : { animation: `ssLoaderDrift ${8 / (speed || 1)}s ease-in-out infinite alternate` }
          }
          className="absolute inset-0"
        >
          {STARS.map((s, i) => (
            <span
              key={i}
              style={{
                position: 'absolute',
                left: `${s.x}%`,
                top: `${s.y}%`,
                width: s.r * 2,
                height: s.r * 2,
                borderRadius: '50%',
                background: 'var(--accent-1, #00c6ff)',
                boxShadow: '0 0 6px var(--accent-1, #00c6ff)',
                opacity: still ? 0.4 : undefined,
                animation: still
                  ? undefined
                  : `ssLoaderTwinkle ${(2.6 + s.d) / (speed || 1)}s ease-in-out ${s.d}s infinite`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Glowing orb + icon */}
      <div
        className="relative w-14 h-14 rounded-full flex items-center justify-center mb-5"
        style={{
          background: 'linear-gradient(135deg, var(--accent-1, #00c6ff), var(--accent-3, #9B6BFF))',
          boxShadow: '0 0 24px var(--border-glow, rgba(0,198,255,0.5))',
          animation: still ? undefined : 'ssLoaderTwinkle 2.4s ease-in-out infinite',
        }}
      >
        <Icon size={24} color="#fff" />
      </div>

      {/* Rotating thought — cross-fade keyed on the message */}
      <p
        key={message}
        className="relative text-sm font-semibold text-text-secondary motion-safe:animate-[ssLoaderFade_0.5s_ease]"
        style={{ minHeight: 20 }}
      >
        <style>{`@keyframes ssLoaderFade { from { opacity: 0; } to { opacity: 1; } }`}</style>
        {message}
      </p>

      {/* Slow-load reassurance + optional retry */}
      {slow && (
        <div className="relative mt-4 flex flex-col items-center gap-2">
          <span className="text-xs text-text-muted">Still exploring… deep space takes a moment.</span>
          {onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-accent bg-accent/10 border border-accent/30 hover:bg-accent/20 transition-colors"
            >
              <RotateCw size={13} /> Retry
            </button>
          )}
        </div>
      )}
    </div>
  );
}
