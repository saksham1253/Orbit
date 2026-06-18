/**
 * CosmicProfileCard — shows a mentor's cosmic standing (badge, tier, score,
 * progress-to-next, earned title, live flair). Rendered BESIDE the existing
 * Trust & Reputation UI, never replacing it (spec §6, §9 — additive).
 *
 * Self-contained and fault-tolerant: while loading it shows a light skeleton,
 * and on error it renders nothing so it can never break the profile page.
 */
import { memo } from 'react';
import { Sparkles, Flame, MoveUpRight, Sun, Radio, Orbit, BadgeCheck, Star } from 'lucide-react';
import CosmicBadge from './CosmicBadge';
import TierProgress from './TierProgress';
import { getTier } from './tiers';
import { useMentorCosmic } from './useCosmic';
import { InfoDot, Disclosure, ScoreExplainerBody } from './scoreInfo';
import { COSMIC_TOOLTIP, COSMIC_SCORE_INFO, SCORE_DISTINCTION } from './scoreCopy';

// Live flair key → professional icon + label (v2 §4, no emoji).
const FLAIR = {
  orbit_streak:     { Icon: Flame,       label: 'Orbit Streak' },
  comet_trail:      { Icon: MoveUpRight, label: 'Comet Trail' },
  solar_flare:      { Icon: Sun,         label: 'Solar Flare' },
  pulsing:          { Icon: Radio,       label: 'Pulsing' },
  strong_gravity:   { Icon: Orbit,       label: 'Strong Gravity' },
  verified_voyager: { Icon: BadgeCheck,  label: 'Verified Voyager' },
  north_star:       { Icon: Star,        label: 'North Star' },
};

const CosmicProfileCard = memo(function CosmicProfileCard({ userId }) {
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
  const flair = (data.flair || []).map((k) => FLAIR[k]).filter(Boolean);
  const atPeak = data.peakTierId && data.peakTierId !== data.tierId;

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
          <div className="text-xs text-text-muted mt-0.5 flex items-center gap-1 flex-wrap">
            <span><span className="font-semibold text-text-secondary">CosmicScore</span> {data.score}</span>
            <InfoDot label="What is CosmicScore?">{COSMIC_TOOLTIP}</InfoDot>
            {data.reviewsCount > 0 && <span>· {data.reviewsCount} {data.reviewsCount === 1 ? 'review' : 'reviews'}</span>}
          </div>
        </div>
      </div>

      {/* Progress — three modes (v2 §1.1): progress / locked / max.
          Shared <TierProgress> so fill width and label never disagree (v7 §1). */}
      <TierProgress progress={progress} size="full" className="mt-4" />

      {/* Live flair */}
      {flair.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-4">
          {flair.map((f) => {
            const Icon = f.Icon;
            return (
              <span key={f.label}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium"
                style={{ background: 'var(--accent-1, #00c6ff)12', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                <Icon size={11} />{f.label}
              </span>
            );
          })}
        </div>
      )}

      {/* Lifetime peak hint */}
      {atPeak && (
        <p className="text-[11px] text-text-muted mt-3">
          Lifetime best: {getTier(data.peakTierId).displayName}
        </p>
      )}

      {/* Trust vs CosmicScore clarity + "how it works" explainer (§4, §4.5) */}
      <p className="text-[11px] text-text-muted mt-4 mb-2">{SCORE_DISTINCTION}</p>
      <Disclosure title={COSMIC_SCORE_INFO.title}>
        <ScoreExplainerBody info={COSMIC_SCORE_INFO} />
      </Disclosure>
    </div>
  );
});

export default CosmicProfileCard;
