/**
 * TierAtlas — "Explore all levels" codex (v2 §6). Public browse of all 25
 * cosmic tiers grouped by category, each card showing the badge, name, the
 * wonderful description, the CosmicScore range, eligibility requirement, and
 * the perks unlocked. A "You are here" marker highlights the viewer's tier.
 *
 * Sits on the global constellation background; reuses CosmicBadge + tier data.
 */
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import { MapPin, Lock, ArrowLeft } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useMentorCosmic } from '../cosmic/useCosmic';
import CosmicBadge from '../cosmic/CosmicBadge';
import { TIER_ORDER, getTier, scoreRange, tierRequirement, tierPerks } from '../cosmic/tiers';

const CATEGORIES = [
  { key: 'stardust',  title: 'Stardust',  tagline: 'The Descent — recovery tiers; everyone can climb back.' },
  { key: 'meteor',    title: 'Meteor',    tagline: 'Still burning. Turn the fall into momentum.' },
  { key: 'asteroid',  title: 'Asteroid',  tagline: 'Almost a moon. Gather a little more mass.' },
  { key: 'moon',      title: 'Moon',      tagline: 'Every journey starts small.' },
  { key: 'planet',    title: 'Planet',    tagline: "You've arrived." },
  { key: 'star',      title: 'Star',      tagline: 'You generate your own light.' },
  { key: 'pulsar',    title: 'Pulsar',    tagline: 'City-sized, unimaginably dense.' },
  { key: 'supernova', title: 'Supernova', tagline: 'Brilliant, unmissable.' },
  { key: 'galaxy',    title: 'Galaxy',    tagline: 'A universe unto yourself.' },
  { key: 'quasar',    title: 'Quasar',    tagline: 'Beyond the ladder.' },
];

function TierCard({ tierId, isHere }) {
  const t = getTier(tierId);
  const range = scoreRange(tierId);
  const req = tierRequirement(tierId);
  const perks = tierPerks(tierId);
  const secret = t.category === 'quasar';

  return (
    <div className="p-4 rounded-2xl flex gap-4"
      style={{
        background: isHere ? 'var(--accent-1, #00c6ff)12' : 'var(--surface)',
        border: isHere ? '1px solid var(--accent-1)' : '1px solid var(--border-subtle)',
      }}>
      <div className="flex-none flex flex-col items-center gap-1.5">
        {secret ? (
          <div className="w-[57px] h-[57px] rounded-full grid place-items-center"
            style={{ background: 'rgba(142,197,255,0.08)', border: '1px solid var(--border-subtle)' }}>
            <Lock size={18} className="text-text-muted" />
          </div>
        ) : (
          <CosmicBadge tierId={tierId} size="full" />
        )}
        {range && <span className="text-[10px] text-text-muted tabular-nums">{range.lo} – {range.hi}</span>}
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold text-text-primary">{t.displayName}</span>
          {isHere && <span className="text-[10px] font-bold text-accent flex items-center gap-1"><MapPin size={11} /> YOU ARE HERE</span>}
        </div>
        <p className="text-xs text-text-secondary mt-1 leading-relaxed">{t.blurb}</p>
        {req && <p className="text-[11px] text-text-muted mt-1.5">{req}</p>}
        {perks.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {perks.map((p) => (
              <li key={p} className="text-[10px] px-2 py-0.5 rounded-full"
                style={{ background: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>{p}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function TierAtlas() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { data: me } = useMentorCosmic(user?._id, !!user?._id);
  const hereTier = me?.tierId;

  return (
    <>
      <Helmet><title>Cosmic Tier Atlas · Orbit</title></Helmet>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary mb-3">
          <ArrowLeft size={13} /> Back
        </button>
        <h1 className="text-xl font-display font-bold text-text-primary">Cosmic Tier Atlas</h1>
        <p className="text-xs text-text-muted mb-1">Every level from Moon to Quasar — the score, requirements, and perks to reach each.</p>
        {me && (
          <p className="text-xs text-accent mb-5">You are currently {getTier(me.tierId).displayName} · CosmicScore {me.score}.</p>
        )}

        {CATEGORIES.map((cat) => {
          const ids = TIER_ORDER.filter((id) => getTier(id).category === cat.key);
          return (
            <div key={cat.key} className="mb-7">
              <div className="flex items-baseline gap-2 mb-2.5">
                <h2 className="text-base font-display font-bold text-text-primary">{cat.title}</h2>
                <span className="text-[11px] text-text-muted italic">{cat.tagline}</span>
              </div>
              <div className="space-y-2">
                {ids.map((id) => <TierCard key={id} tierId={id} isHere={id === hereTier} />)}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
