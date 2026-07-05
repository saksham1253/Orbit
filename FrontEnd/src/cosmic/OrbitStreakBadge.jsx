/**
 * OrbitStreakBadge — compact streak chip for the navbar / dashboard.
 *
 * Reads the shared ['orbit','me'] query (so it stays in sync with the Orbit
 * page). Colour + motion encode the decay state: an ACTIVE orbit glows steady
 * amber, a DECAYING one pulses red with a "keep it alive" nudge, and an idle
 * user sees a muted invite to start one. Links to the /orbit hub.
 */
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Flame } from 'lucide-react';
import { useOrbit } from './useOrbit';

const STATE_STYLE = {
  active:   { ring: 'ring-amber-400/60',  text: 'text-amber-300',  glow: '0 0 10px rgba(251,191,36,.45)' },
  decaying: { ring: 'ring-rose-400/70',   text: 'text-rose-300',   glow: '0 0 12px rgba(251,113,133,.55)' },
  idle:     { ring: 'ring-slate-500/40',  text: 'text-slate-300',  glow: 'none' },
};

export default function OrbitStreakBadge({ variant = 'chip', className = '' }) {
  const { data, isLoading } = useOrbit();
  if (isLoading || !data) return null;

  const { current, state } = data.streak || {};
  const s = STATE_STYLE[state] || STATE_STYLE.idle;
  const decaying = state === 'decaying';
  const label = current > 0 ? `${current}` : '0';

  return (
    <NavLink
      to="/orbit"
      title={
        state === 'active' ? `Orbit stable — ${current}-day streak`
          : decaying ? `Your orbit is decaying — act today to keep your ${current}-day streak`
          : 'Start your Orbit streak'
      }
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ring-1 ${s.ring} bg-slate-900/50 backdrop-blur ${s.text} ${className}`}
      style={{ boxShadow: s.glow }}
      aria-label={`Orbit streak ${label} days, ${state}`}
    >
      <motion.span
        animate={decaying ? { scale: [1, 1.18, 1] } : { scale: 1 }}
        transition={decaying ? { repeat: Infinity, duration: 1.1 } : {}}
        className="inline-flex"
      >
        <Flame size={variant === 'nav' ? 15 : 16} strokeWidth={2.4} />
      </motion.span>
      <span className="text-sm font-bold tabular-nums leading-none">{label}</span>
      {decaying && variant !== 'nav' && (
        <span className="text-[10px] font-semibold uppercase tracking-wide text-rose-300/90">decaying</span>
      )}
    </NavLink>
  );
}
