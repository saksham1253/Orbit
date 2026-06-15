/**
 * Leaderboard — the local cosmic mentor board (spec §11, §13).
 *
 * Tier/division are absolute (everyone can climb); RANK is relative within the
 * resolved geographic scope (local + winnable). Shows a scope toggle, the
 * viewer's own rank card, and a ranked list with mini cosmic badges.
 *
 * Additive page — reuses existing common components, api, and CosmicBadge.
 */
import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import useLiftoffStore from '../cosmic/liftoffStore';
import { Trophy, MapPin, Info, Telescope, Building2, Map as MapIcon, Globe, Medal, Compass } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useLeaderboard } from '../cosmic/useCosmic';
import CosmicBadge from '../cosmic/CosmicBadge';
import CosmicName from '../cosmic/CosmicName';
import { getTier } from '../cosmic/tiers';
import Avatar from '../components/common/Avatar';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';

const SCOPES = [
  { id: 'neighborhood', label: 'Neighborhood', Icon: MapPin },
  { id: 'city',         label: 'City',         Icon: Building2 },
  { id: 'region',       label: 'Region',       Icon: MapIcon },
  { id: 'country',      label: 'Country',      Icon: Globe },
];

const MEDAL_TINT = { 1: '#FFD08A', 2: '#D6DCE6', 3: '#E0A878' };

function RankBadge({ rank }) {
  if (rank <= 3) {
    return (
      <span className="inline-flex items-center justify-center w-7" title={`Rank ${rank}`}>
        <Medal size={18} style={{ color: MEDAL_TINT[rank] }} strokeWidth={2.2} />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center w-7 text-sm font-bold tabular-nums text-text-muted">
      {rank}
    </span>
  );
}

export default function Leaderboard() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [scope, setScope] = useState('city');

  const { data, isLoading, isError, error, refetch } = useLeaderboard({ scope });
  const playLiftoff = useLiftoffStore((s) => s.play);
  const markIntroSeen = useLiftoffStore((s) => s.markIntroSeen);

  // v2 §7.1 — first time the viewer opens the board at a given tier, play a
  // welcome rank-up reveal for their current tier (once per tier per account).
  useEffect(() => {
    const you = data?.you;
    if (!you?.tierId || !user?._id) return;
    const already = markIntroSeen(user._id, you.tierId);
    if (!already) {
      playLiftoff(you.tierId, { score: you.score, city: data?.label });
    }
  }, [data?.you?.tierId, user?._id, data?.label, markIntroSeen, playLiftoff]);

  const needsLocation = error?.response?.data?.needsLocation;

  return (
    <>
      <Helmet><title>Cosmic Leaderboard · SkillSwap</title></Helmet>
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, var(--accent-1), var(--accent-3))', boxShadow: '0 0 16px var(--border-glow)' }}>
            <Trophy size={20} color="#fff" />
          </div>
          <div>
            <h1 className="text-xl font-display font-bold text-text-primary">Cosmic Leaderboard</h1>
            <p className="text-xs text-text-muted">Climb your local sky — rank is relative, tier is earned.</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <button onClick={() => navigate('/cosmic-atlas')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-text-secondary hover:text-text-primary bg-surface border border-border-subtle transition-all">
              <Compass size={13} /> Explore tiers
            </button>
            <button onClick={() => navigate('/observatory')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-text-secondary hover:text-text-primary bg-surface border border-border-subtle transition-all">
              <Telescope size={13} /> Observatory
            </button>
          </div>
        </div>

        {/* Scope toggle — with real per-scope mentor counts (§8.5) */}
        <div className="flex flex-wrap gap-1.5 mt-4 mb-3">
          {SCOPES.map((s) => {
            const active = scope === s.id;
            const Icon = s.Icon;
            const count = data?.scopeCounts?.[s.id];
            return (
              <button key={s.id} onClick={() => setScope(s.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  active ? 'text-accent bg-accent/10 border border-accent/30'
                         : 'text-text-secondary hover:text-text-primary bg-surface border border-border-subtle'}`}>
                <Icon size={13} />{s.label}
                {count != null && <span className="opacity-70 tabular-nums">· {count}</span>}
              </button>
            );
          })}
        </div>

        {/* Honest scope label + coverage messaging (§8.5) */}
        {data?.label && (
          <div className="flex items-center gap-1.5 text-xs text-text-muted mb-2">
            <MapPin size={12} />
            <span>
              Showing mentors {data.label}
              {data.widened && data.appliedRadiusKm ? ` (widened to ${data.appliedRadiusKm} km to fill the board)` : ''}.
            </span>
          </div>
        )}

        {/* Viewer has no location → board fell back to Country; nudge them. */}
        {data?.viewerNeedsLocation && (
          <button onClick={() => navigate('/nearby')}
            className="flex items-start gap-2 w-full text-left p-3 rounded-2xl mb-3 text-xs"
            style={{ background: 'var(--surface)', border: '1px solid var(--accent-1)' }}>
            <Compass size={14} className="mt-0.5 flex-none text-accent" />
            <span className="text-text-secondary">
              <strong className="text-text-primary">Add your city</strong> to see who’s ranked near you.
              We’re showing the country board for now. <span className="text-accent underline">Set location</span>
            </span>
          </button>
        )}

        {/* City sparse but mentors lack a location → offer wider scopes + explain. */}
        {scope === 'city' && data?.unplacedCount > 0 && (
          <div className="flex items-start gap-2 p-3 rounded-2xl mb-3 text-xs"
            style={{ background: 'var(--surface)', border: '1px dashed var(--border-subtle)' }}>
            <MapPin size={14} className="mt-0.5 flex-none text-text-muted" />
            <div className="text-text-muted">
              <span className="text-text-secondary">
                {data.unplacedCount} {data.unplacedCount === 1 ? 'mentor hasn’t' : 'mentors haven’t'} set a city yet,
                so they’re ranked in Region/Country instead.
              </span>
              <div className="flex gap-1.5 mt-2">
                <button onClick={() => setScope('region')}
                  className="px-2.5 py-1 rounded-lg font-semibold text-accent bg-accent/10 border border-accent/30">
                  See Region{data.scopeCounts?.region != null ? ` · ${data.scopeCounts.region}` : ''}
                </button>
                <button onClick={() => setScope('country')}
                  className="px-2.5 py-1 rounded-lg font-semibold text-accent bg-accent/10 border border-accent/30">
                  See Country{data.scopeCounts?.country != null ? ` · ${data.scopeCounts.country}` : ''}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Your rank card */}
        {data?.you && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 p-3 rounded-2xl mb-5"
            style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}>
            <CosmicBadge tierId={data.you.tierId} size="full" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-text-primary truncate">
                You — {getTier(data.you.tierId).displayName}
              </div>
              <div className="text-xs text-text-muted">
                Score {data.you.score} · Rank #{data.you.rank} of {data.you.of}
              </div>
              {/* progress to next tier (locked / progress / max) */}
              <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
                <div className="h-full rounded-full" style={{
                  width: `${Math.round(((data.you.progress?.pct ?? data.you.progressToNext) || 0) * 100)}%`,
                  background: data.you.progress?.mode === 'locked'
                    ? 'linear-gradient(90deg, #6b7280, #9ca3af)'
                    : 'linear-gradient(90deg, var(--accent-1), var(--accent-3))',
                }} />
              </div>
              {data.you.progress?.label && (
                <p className="text-[11px] text-text-muted mt-1">{data.you.progress.label}</p>
              )}
            </div>
          </motion.div>
        )}

        {/* List states */}
        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-14 rounded-2xl animate-pulse" style={{ background: 'var(--surface)' }} />
            ))}
          </div>
        )}

        {isError && !needsLocation && (
          <ErrorState message={error?.response?.data?.message || 'Failed to load the leaderboard.'} onRetry={refetch} />
        )}

        {isError && needsLocation && (
          <EmptyState
            icon={<MapPin size={28} />}
            title="Set your location to see the board"
            description="The neighborhood and city boards need your location. Set it on the Nearby map, then come back."
            ctaLabel="Go to Nearby"
            onCta={() => navigate('/nearby')}
          />
        )}

        {!isLoading && !isError && data?.entries?.length === 0 && (
          <EmptyState
            icon={<Trophy size={28} />}
            title="No mentors here yet"
            description="Be the first to light up this sky. As mentors earn reviews, they'll appear on the board."
          />
        )}

        {!isLoading && !isError && data?.entries?.length > 0 && (
          <ul className="space-y-1.5">
            {data.entries.map((e) => {
              const isMe = e.userId === user?._id;
              return (
                <li key={e.userId}>
                  <button
                    onClick={() => navigate(`/profile/${e.userId}`)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-2xl transition-all text-left hover:bg-surface"
                    style={{
                      background: isMe ? 'var(--accent-1, #00c6ff)10' : 'transparent',
                      border: isMe ? '1px solid var(--accent-1)' : '1px solid var(--border-subtle)',
                    }}>
                    <RankBadge rank={e.rank} />
                    <Avatar name={e.name} url={e.avatar} size="sm" userId={e.userId} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-text-primary truncate flex items-center gap-1.5">
                        <CosmicName glow={e.nameGlowTier}>{e.name}</CosmicName>{isMe && <span className="text-[10px] text-accent font-bold">YOU</span>}
                      </div>
                      <div className="text-xs text-text-muted truncate">
                        {getTier(e.tierId).displayName}{e.title ? ` · ${e.title}` : ''}
                      </div>
                    </div>
                    <CosmicBadge tierId={e.tierId} size="mini" />
                    <span className="text-sm font-bold tabular-nums text-text-secondary w-12 text-right">{e.score}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {/* Footer note */}
        <div className="flex items-start gap-1.5 text-[11px] text-text-muted mt-6 mb-24">
          <Info size={12} className="mt-0.5 flex-none" />
          <span>Tiers are earned from genuine reviews and completed swaps. Rank is local, so it's always winnable.</span>
        </div>
      </div>

      {/* Sticky game-style "Your Position" bar — always visible (v3 §2) */}
      {!isLoading && !isError && data?.you?.rank && (
        <div className="fixed bottom-0 left-0 right-0 z-30 px-4 pb-3 pointer-events-none">
          <button onClick={() => navigate(`/profile/${data.you.userId}`)}
            className="pointer-events-auto max-w-3xl mx-auto w-full flex items-center gap-3 p-2.5 rounded-2xl text-left shadow-2xl backdrop-blur"
            style={{ background: 'var(--surface)', border: '1px solid var(--accent-1)', boxShadow: '0 8px 30px rgba(0,0,0,0.35)' }}>
            <div className="flex flex-col items-center justify-center w-12 flex-none">
              <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--accent-1)' }}>#{data.you.rank}</span>
              <span className="text-[9px] text-text-muted">of {data.you.of}</span>
            </div>
            <Avatar name={data.you.name} url={data.you.avatar} size="sm" userId={data.you.userId} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-text-primary truncate flex items-center gap-1.5">
                <CosmicName glow={data.you.nameGlowTier}>{data.you.name}</CosmicName>
                <span className="text-[10px] text-accent font-bold">YOU</span>
                {!data.you.inTop50 && <span className="text-[9px] text-text-muted">· outside top 50</span>}
              </div>
              <div className="text-xs text-text-muted truncate">{getTier(data.you.tierId).displayName}</div>
            </div>
            <CosmicBadge tierId={data.you.tierId} size="mini" />
            <span className="text-sm font-bold tabular-nums text-text-secondary w-12 text-right">{data.you.score}</span>
          </button>
        </div>
      )}
    </>
  );
}
