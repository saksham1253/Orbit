/**
 * Observatory — the cosmic Hall of Fame for a city (spec §10).
 *
 * Sits on the app's existing Constellation background (rendered globally behind
 * everything). The "Local Sky" is a gravity layout: the #1 mentor is the North
 * Star at center, and lower ranks orbit at increasing radius. Below it: the
 * Supernova of the Month spotlight (with a BERT-picked best-review quote) and
 * the Legends Archive (retired #1s → Quasars).
 *
 * Additive page; reuses CosmicBadge + Avatar + common states.
 */
import { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Telescope, Crown, Star, Sparkles, Quote } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useObservatory } from '../cosmic/useCosmic';
import CosmicBadge from '../cosmic/CosmicBadge';
import { getTier } from '../cosmic/tiers';
import Avatar from '../components/common/Avatar';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';

// Distribute orbiting mentors on concentric rings around the North Star.
function orbitPositions(count, size) {
  const center = size / 2;
  const baseR = size * 0.17;
  const step = size * 0.13;
  const perRing = [6, 9, 12];
  const out = [];
  let placed = 0, ring = 0;
  while (placed < count) {
    const n = Math.min(perRing[ring] ?? 14, count - placed);
    const r = baseR + ring * step;
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2 + ring * 0.6;
      out.push({
        x: center + Math.cos(angle) * r,
        y: center + Math.sin(angle) * r,
      });
      placed++;
    }
    ring++;
  }
  return out;
}

export default function Observatory() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [cityInput, setCityInput] = useState('');
  const [city, setCity] = useState('');

  const { data, isLoading, isError, refetch } = useObservatory(city);

  const SIZE = 560;
  const positions = useMemo(
    () => orbitPositions((data?.orbiting?.length) || 0, SIZE),
    [data?.orbiting?.length]
  );

  return (
    <>
      <Helmet><title>The Observatory · SkillSwap</title></Helmet>
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #9B6BFF, #FF8FCF)', boxShadow: '0 0 16px rgba(155,107,255,0.5)' }}>
            <Telescope size={20} color="#fff" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-display font-bold text-text-primary">The Observatory</h1>
            <p className="text-xs text-text-muted">{data?.city ? `The sky over ${data.city}` : 'Your local sky of mentors'}</p>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); setCity(cityInput); }} className="flex gap-1.5">
            <input value={cityInput} onChange={(e) => setCityInput(e.target.value)} placeholder="City…"
              className="input-glass px-3 py-1.5 text-xs text-text-primary rounded-xl w-28" />
            <button type="submit"
              className="px-3 py-1.5 rounded-xl text-xs font-semibold text-accent bg-accent/10 border border-accent/30">
              View
            </button>
          </form>
        </div>

        {isLoading && (
          <div className="h-[560px] rounded-2xl animate-pulse" style={{ background: 'var(--surface)' }} />
        )}
        {isError && <ErrorState message="Failed to load the Observatory." onRetry={refetch} />}

        {!isLoading && !isError && !data?.northStar && (
          <EmptyState icon={<Telescope size={28} />} title="This sky is still dark"
            description="As mentors earn reviews here, the brightest will light up the Observatory." />
        )}

        {!isLoading && !isError && data?.northStar && (
          <>
            {/* ── The Local Sky (gravity layout) ── */}
            <div className="relative mx-auto rounded-3xl overflow-hidden"
              style={{ width: SIZE, maxWidth: '100%', height: SIZE,
                background: 'radial-gradient(circle at 50% 50%, rgba(26,11,46,0.4), rgba(13,2,33,0.2))',
                border: '1px solid var(--border-subtle)' }}>
              {/* orbit rings */}
              {[0.17, 0.30, 0.43].map((f, i) => (
                <div key={i} className="absolute rounded-full" style={{
                  left: '50%', top: '50%', width: SIZE * f * 2, height: SIZE * f * 2,
                  transform: 'translate(-50%,-50%)', border: '1px dashed rgba(255,255,255,0.07)',
                }} />
              ))}

              {/* orbiting mentors */}
              {data.orbiting.map((m, i) => {
                const p = positions[i];
                if (!p) return null;
                return (
                  <button key={m.userId} onClick={() => navigate(`/profile/${m.userId}`)}
                    title={`#${m.rank} ${m.name} — ${getTier(m.tierId).displayName}`}
                    className="absolute flex flex-col items-center -translate-x-1/2 -translate-y-1/2 group"
                    style={{ left: p.x, top: p.y }}>
                    <CosmicBadge tierId={m.tierId} size={m.rank <= 6 ? 'full' : 'mini'} />
                    <span className="text-[9px] text-text-muted mt-0.5 max-w-[60px] truncate opacity-0 group-hover:opacity-100 transition-opacity">
                      {m.name}
                    </span>
                  </button>
                );
              })}

              {/* North Star (center) */}
              <button onClick={() => navigate(`/profile/${data.northStar.userId}`)}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                <div className="flex items-center gap-1 mb-1 text-[10px] font-bold" style={{ color: '#FFD08A' }}>
                  <Crown size={12} /> NORTH STAR
                </div>
                <div style={{ transform: 'scale(1.5)' }}>
                  <CosmicBadge tierId={data.northStar.tierId} size="full" />
                </div>
                <span className="text-xs font-bold text-text-primary mt-2">{data.northStar.name}</span>
                <span className="text-[10px] text-text-muted">{getTier(data.northStar.tierId).displayName}</span>
              </button>
            </div>

            {/* ── Supernova of the Month ── */}
            {data.spotlight && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                className="mt-6 p-5 rounded-2xl"
                style={{ background: 'linear-gradient(135deg, rgba(255,107,53,0.08), rgba(255,143,207,0.06))',
                  border: '1px solid rgba(255,107,53,0.2)' }}>
                <div className="flex items-center gap-2 mb-3 text-xs font-bold" style={{ color: '#FF8C42' }}>
                  <Sparkles size={14} /> SUPERNOVA OF THE MONTH
                </div>
                <div className="flex items-center gap-4">
                  <CosmicBadge tierId={data.spotlight.tierId} size="full" />
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-text-primary">{data.spotlight.name}</div>
                    <div className="text-xs text-text-muted">{getTier(data.spotlight.tierId).displayName} · Score {data.spotlight.score}</div>
                  </div>
                </div>
                {data.spotlight.quote && (
                  <div className="mt-3 flex gap-2 text-sm text-text-secondary italic">
                    <Quote size={16} className="flex-none opacity-50" />
                    <span>“{data.spotlight.quote}”{data.spotlight.quoteBy ? <span className="not-italic text-text-muted text-xs"> — {data.spotlight.quoteBy}</span> : null}</span>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── Legends Archive (Quasars) ── */}
            <div className="mt-6">
              <div className="flex items-center gap-2 mb-3 text-sm font-display font-bold text-text-primary">
                <Star size={15} style={{ color: '#8EC5FF' }} /> Legends Archive
              </div>
              {data.legends?.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {data.legends.map((l, i) => (
                    <button key={i} onClick={() => l.userId && navigate(`/profile/${l.userId}`)}
                      className="flex items-center gap-3 p-3 rounded-2xl text-left"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}>
                      <CosmicBadge tierId="quasar" size="mini" />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-text-primary truncate">{l.starName || l.name}</div>
                        <div className="text-[11px] text-text-muted">{l.name} · Season {l.seasonId}</div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-text-muted p-4 rounded-2xl text-center"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}>
                  No legends yet. The first retired #1 champion becomes a permanent Quasar here. 🌠
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
