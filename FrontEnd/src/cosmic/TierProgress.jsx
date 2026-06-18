/**
 * TierProgress — the single source of truth for the cosmic tier-progress bar
 * (v7 §1 / v6 §8.6). The fill width and the label are both derived from the
 * SAME `progress` object, so they can never disagree.
 *
 * `progress` shape (from the cosmicTier service): { mode, pct, label }
 *   - mode "progress": normal climb toward the next tier
 *   - mode "locked":   next tier gated (e.g. needs a full season)
 *   - mode "max":      highest tier reached
 *
 * Sizes:
 *   - "full" (leaderboard / profile card): header row + bar + label
 *   - "mini" (Browse / list cards):        compact bar + % only
 */
import { memo } from 'react';
import { TrendingUp, Lock, Trophy } from 'lucide-react';

const TierProgress = memo(function TierProgress({ progress, size = 'full', className = '' }) {
  const p = progress || { mode: 'progress', pct: 0, label: '' };
  const pct = Math.round((p.pct || 0) * 100);
  const isLocked = p.mode === 'locked';
  const isMax = p.mode === 'max';
  const fillWidth = `${isMax ? 100 : pct}%`;
  const fillBg = isLocked
    ? 'linear-gradient(90deg, #6b7280, #9ca3af)'
    : 'linear-gradient(90deg, var(--accent-1), var(--accent-3))';

  if (size === 'mini') {
    return (
      <div className={className}>
        <div className="flex items-center gap-2">
          <div className="h-1 flex-1 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
            <div className="h-full rounded-full" style={{ width: fillWidth, background: fillBg }} />
          </div>
          <span className="text-[10px] text-text-muted tabular-nums flex-none">
            {isMax ? 'Max' : isLocked ? <Lock size={10} /> : `${pct}%`}
          </span>
        </div>
      </div>
    );
  }

  // Full variant — markup kept identical to the original CosmicProfileCard bar.
  return (
    <div className={className}>
      <div className="flex items-center justify-between text-[11px] text-text-muted mb-1">
        <span className="flex items-center gap-1">
          {isMax ? <Trophy size={11} /> : isLocked ? <Lock size={11} /> : <TrendingUp size={11} />}
          {isMax ? 'Highest tier in the cosmos' : isLocked ? 'Next tier locked' : 'Progress to next tier'}
        </span>
        {!isLocked && !isMax && <span>{pct}%</span>}
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
        <div className="h-full rounded-full" style={{ width: fillWidth, background: fillBg }} />
      </div>
      {p.label && (
        <p className="text-[11px] text-text-muted mt-1.5">
          {p.label}{isMax ? '.' : ''}
        </p>
      )}
    </div>
  );
});

export default TierProgress;
