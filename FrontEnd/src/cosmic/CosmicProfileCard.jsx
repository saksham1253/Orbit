/**
 * CosmicProfileCard — shows a mentor's cosmic standing (badge, tier, score,
 * progress-to-next, earned title, live flair). Rendered BESIDE the existing
 * Trust & Reputation UI, never replacing it (spec §6, §9 — additive).
 *
 * Self-contained and fault-tolerant: while loading it shows a light skeleton,
 * and on error it renders nothing so it can never break the profile page.
 */
import { memo } from 'react';
import { Sparkles, TrendingUp, Lock, Trophy } from 'lucide-react';
import CosmicBadge from './CosmicBadge';
import { getTier } from './tiers';
import { useMentorCosmic } from './useCosmic';

// Live flair key → display (spec §9.2).
const FLAIR = {
  orbit_streak:     { emoji: '🔥', label: 'Orbit Streak' },
  comet_trail:      { emoji: '☄️', label: 'Comet Trail' },
  solar_flare:      { emoji: '🌞', label: 'Solar Flare' },
  pulsing:          { emoji: '💫', label: 'Pulsing' },
  strong_gravity:   { emoji: '🪐', label: 'Strong Gravity' },
  verified_voyager: { emoji: '✅', label: 'Verified Voyager' },
  north_star:       { emoji: '⭐', label: 'North Star' },
};

const CosmicProfileCard = memo(function CosmicProfileCard({ userId, self = false }) {
  const { data, isLoading, isError } = useMentorCosmic(userId);

  if (isError) return null; // never break the host page

  if (isLoading || !data) {
    return (
      <div className="flex items-center gap-4 p-5 rounded-2xl animate-pulse"
        style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}>
        <div className="w-[57px] h-[57px] rounded-full" style={{ background: 'var(--border-subtle)' }} />
        <div className="flex-1 space-y-2">
          <div className="h-3 w-32 rounded" style={{ background: 'var(--border-subtle)' }} />
          <div className="h-2 w-full rounded" style={{ background: 'var(--border-subtle)' }} />
        </div>
      </div>
    );
  }

  const tier = getTier(data.tierId);
  const progress = data.progress || { mode: 'progress', pct: data.progressToNext || 0, label: '' };
  const pct = Math.round((progress.pct || 0) * 100);
  const flair = (data.flair || []).map((k) => FLAIR[k]).filter(Boolean);
  const atPeak = data.peakTierId && data.peakTierId !== data.tierId;
  const isLocked = progress.mode === 'locked';
  const isMax = progress.mode === 'max';

  return (
    <div className="p-5 rounded-2xl"
      style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}>
      <div className="flex items-center gap-2 mb-4">
        <Sparkles size={15} className="text-accent" />
        <h2 className="font-display font-bold text-text-primary text-base">Cosmic Standing</h2>
      </div>

      <div className="flex items-center gap-4">
        <CosmicBadge tierId={data.tierId} size="full" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-text-primary truncate">{tier.displayName}</div>
          {data.currentTitle && (
            <div className="text-xs text-accent font-semibold mt-0.5 truncate">{data.currentTitle}</div>
          )}
          <div className="text-xs text-text-muted mt-0.5">
            CosmicScore {data.score}
            {data.reviewsCount > 0 && <> · {data.reviewsCount} {data.reviewsCount === 1 ? 'review' : 'reviews'}</>}
          </div>
        </div>
      </div>

      {/* Progress — three modes (v2 §1.1): progress / locked / max */}
      <div className="mt-4">
        <div className="flex items-center justify-between text-[11px] text-text-muted mb-1">
          <span className="flex items-center gap-1">
            {isMax ? <Trophy size={11} /> : isLocked ? <Lock size={11} /> : <TrendingUp size={11} />}
            {isMax ? 'Highest tier in the cosmos' : isLocked ? 'Next tier locked' : 'Progress to next tier'}
          </span>
          {!isLocked && !isMax && <span>{pct}%</span>}
        </div>
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
          <div className="h-full rounded-full" style={{
            width: `${isMax ? 100 : pct}%`,
            background: isLocked
              ? 'linear-gradient(90deg, #6b7280, #9ca3af)'
              : 'linear-gradient(90deg, var(--accent-1), var(--accent-3))',
          }} />
        </div>
        {progress.label && (
          <p className="text-[11px] text-text-muted mt-1.5">
            {self && !isMax ? '' : ''}{progress.label}{isMax ? '.' : ''}
          </p>
        )}
      </div>

      {/* Live flair */}
      {flair.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-4">
          {flair.map((f) => (
            <span key={f.label}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium"
              style={{ background: 'var(--accent-1, #00c6ff)12', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              <span>{f.emoji}</span>{f.label}
            </span>
          ))}
        </div>
      )}

      {/* Lifetime peak hint */}
      {atPeak && (
        <p className="text-[11px] text-text-muted mt-3">
          Lifetime best: {getTier(data.peakTierId).displayName}
        </p>
      )}
    </div>
  );
});

export default CosmicProfileCard;
