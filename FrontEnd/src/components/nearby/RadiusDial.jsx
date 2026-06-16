/**
 * RadiusDial — on-theme "search horizon" radius control for Nearby (v6 §5).
 *
 * Replaces the flat range slider with a radar of concentric rings around a
 * center pin: the active ring grows with the selected radius and a value bubble
 * shows "N km". Values snap to friendly steps (5/10/25/50/100/250/500). The
 * control is a proper `role="slider"` — focusable, arrow/Home/End keyboard
 * support, aria-valuenow/min/max/text — with large clickable step rings for
 * touch. Reduced-motion → rings cross-fade instead of animating their radius.
 *
 * Presentation only: it just reports the snapped value via `onChange`; the page
 * keeps its existing radius state and `?radius=<km>` query contract.
 */
import { useMemo } from 'react';
import useAppearanceStore from '../../store/appearanceStore';

const RADIUS_STEPS = [5, 10, 25, 50, 100, 250, 500];

const SIZE = 200;              // svg viewport
const CENTER = SIZE / 2;
const MAX_R = SIZE / 2 - 14;   // outer ring radius in px
const MIN_R = 22;              // innermost ring radius in px

export default function RadiusDial({ value, onChange, city }) {
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

  // Snap the incoming value to the nearest step (defensive — page default is 50).
  const stepIndex = useMemo(() => {
    let best = 0, bestD = Infinity;
    RADIUS_STEPS.forEach((s, i) => {
      const d = Math.abs(s - value);
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  }, [value]);

  const setIndex = (i) => {
    const clamped = Math.max(0, Math.min(RADIUS_STEPS.length - 1, i));
    if (RADIUS_STEPS[clamped] !== value) onChange(RADIUS_STEPS[clamped]);
  };

  const onKeyDown = (e) => {
    switch (e.key) {
      case 'ArrowRight': case 'ArrowUp':   e.preventDefault(); setIndex(stepIndex + 1); break;
      case 'ArrowLeft':  case 'ArrowDown': e.preventDefault(); setIndex(stepIndex - 1); break;
      case 'Home': e.preventDefault(); setIndex(0); break;
      case 'End':  e.preventDefault(); setIndex(RADIUS_STEPS.length - 1); break;
      default: break;
    }
  };

  // Radius (px) for the currently selected ring.
  const frac = stepIndex / (RADIUS_STEPS.length - 1);
  const activeR = MIN_R + frac * (MAX_R - MIN_R);

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      {/* Radar */}
      <div
        role="slider"
        tabIndex={0}
        aria-label="Search radius"
        aria-valuemin={RADIUS_STEPS[0]}
        aria-valuemax={RADIUS_STEPS[RADIUS_STEPS.length - 1]}
        aria-valuenow={value}
        aria-valuetext={`${value} kilometers`}
        onKeyDown={onKeyDown}
        className="relative rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
        style={{ width: SIZE, height: SIZE, maxWidth: '100%' }}
      >
        <svg width="100%" height="100%" viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
          {/* Static guide rings for every step — clickable hit targets. */}
          {RADIUS_STEPS.map((s, i) => {
            const r = MIN_R + (i / (RADIUS_STEPS.length - 1)) * (MAX_R - MIN_R);
            const isActive = i === stepIndex;
            const within = i <= stepIndex;
            return (
              <circle
                key={s}
                cx={CENTER}
                cy={CENTER}
                r={r}
                fill="none"
                stroke={within ? 'rgba(0,198,255,0.55)' : 'rgba(255,255,255,0.10)'}
                strokeWidth={isActive ? 2.5 : 1}
                style={{ cursor: 'pointer' }}
                onClick={() => setIndex(i)}
              />
            );
          })}

          {/* Filled "horizon" disc up to the active ring. */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={activeR}
            fill="rgba(0,198,255,0.10)"
            stroke="rgba(0,198,255,0.85)"
            strokeWidth={2.5}
            style={{ transition: still ? 'none' : 'r 0.35s cubic-bezier(0.22,1,0.36,1)' }}
          />

          {/* Sweep pulse (ambient), suppressed under reduced-motion. */}
          {!still && (
            <circle cx={CENTER} cy={CENTER} r={activeR} fill="none" stroke="rgba(0,198,255,0.5)" strokeWidth={1.5}>
              <animate attributeName="r" from={MIN_R} to={activeR} dur={`${2.4 / (speed || 1)}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" from="0.6" to="0" dur={`${2.4 / (speed || 1)}s`} repeatCount="indefinite" />
            </circle>
          )}

          {/* Center pin */}
          <circle cx={CENTER} cy={CENTER} r={5} fill="#00c6ff" />
          <circle cx={CENTER} cy={CENTER} r={9} fill="none" stroke="rgba(0,198,255,0.5)" strokeWidth={1.5} />
        </svg>

        {/* Value bubble — centered over the pin */}
        <div
          className="absolute left-1/2 -translate-x-1/2 pointer-events-none text-center"
          style={{ top: 8 }}
        >
          <div className="px-3 py-1 rounded-full text-sm font-bold tabular-nums"
            style={{ background: 'rgba(0,198,255,0.15)', border: '1px solid rgba(0,198,255,0.4)', color: '#00c6ff' }}>
            {value} km
          </div>
        </div>
      </div>

      {/* Snap-step pills + min/max labels */}
      <div className="w-full">
        <div className="flex items-center justify-between gap-1 overflow-x-auto hide-scrollbar">
          {RADIUS_STEPS.map((s, i) => (
            <button
              key={s}
              type="button"
              onClick={() => setIndex(i)}
              aria-pressed={i === stepIndex}
              className={`flex-none min-w-[40px] min-h-[36px] px-2 rounded-lg text-xs font-semibold tabular-nums transition-colors ${
                i === stepIndex
                  ? 'text-accent bg-accent/15 border border-accent/40'
                  : 'text-text-muted bg-surface border border-border-subtle hover:text-text-secondary'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-text-muted mt-1 px-0.5">
          <span>{RADIUS_STEPS[0]} km min</span>
          <span>{RADIUS_STEPS[RADIUS_STEPS.length - 1]} km max</span>
        </div>
      </div>

      {/* Live hint */}
      <p className="text-xs text-text-secondary text-center" aria-live="polite">
        Searching within <strong className="text-text-primary">{value} km</strong>
        {city ? <> of <strong className="text-text-primary">{city}</strong></> : ' of your location'}
      </p>
    </div>
  );
}
