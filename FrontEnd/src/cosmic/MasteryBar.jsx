/**
 * MasteryBar — per-skill teaching mastery on a skill card (Orbit Engine, Tier 3).
 *
 * Renders the skill's earned teaching badge (e.g. "Guitar Mentor"), a progress
 * bar toward the next rank, and the sessions-taught count. Reads the `mastery`
 * object the skill API attaches (services/skillMastery.js). Renders nothing
 * until at least one session is taught, so fresh listings stay clean.
 */
import { GraduationCap } from 'lucide-react';

// Rank → accent color (ascending prestige).
const RANK_COLOR = {
  Initiate: '#9ca3af',
  Apprentice: '#7dd3fc',
  Mentor: '#c084fc',
  Master: '#fcd34d',
  Grandmaster: '#f59e0b',
};

export default function MasteryBar({ mastery }) {
  if (!mastery || !mastery.sessionsTaught) return null;

  const color = RANK_COLOR[mastery.rank] || '#c084fc';
  const { badge, sessionsTaught, next, progressPct, toNext, maxed } = mastery;

  return (
    <div className="rounded-lg border border-white/10 bg-slate-900/30 px-2.5 py-2">
      <div className="flex items-center gap-1.5 mb-1.5">
        <GraduationCap size={13} style={{ color }} />
        <span className="text-xs font-bold truncate" style={{ color }}>{badge}</span>
        <span className="ml-auto text-[11px] text-slate-400 tabular-nums shrink-0">
          {sessionsTaught} taught
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${progressPct}%`, background: `linear-gradient(90deg, ${color}, #f472b6)` }}
        />
      </div>
      <div className="mt-1 text-[10px] text-slate-500">
        {maxed ? 'Max mastery reached' : `${toNext} more to ${next.title}`}
      </div>
    </div>
  );
}
