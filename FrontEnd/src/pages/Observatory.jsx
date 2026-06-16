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
import { Telescope, Crown, Star, Sparkles, Quote, Info, TrendingUp } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useObservatory } from '../cosmic/useCosmic';
import CosmicBadge from '../cosmic/CosmicBadge';
import CosmicLoader from '../cosmic/CosmicLoader';
import CosmicName from '../cosmic/CosmicName';
import { getTier, nameGlowFor } from '../cosmic/tiers';
import { InfoDot, Disclosure, ScoreExplainerBody } from '../cosmic/scoreInfo';
import { SCORE_DISTINCTION, COSMIC_SCORE_INFO, TRUST_SCORE_INFO } from '../cosmic/scoreCopy';
import Modal from '../components/common/Modal';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';

const COACH_KEY = 'cosmic-observatory-coachmark-v1';
const COACH_STEPS = [
  { title: 'The North Star', body: 'The mentor at the center is the current #1 in this scope.' },
  { title: 'The Orbit', body: 'The next top mentors orbit around it — closer and numbered by rank.' },
  { title: 'You are here', body: 'Your own node is highlighted, or shown as a “Your standing” chip so you always know where you stand.' },
];

const PROVISIONAL_TIP = 'Provisional: scores are tied early this season. The North Star locks in as mentors earn more reviews.';

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
  const meId = user?._id ? String(user._id) : null;

  const [showInfo, setShowInfo] = useState(false);
  // One-time 3-step coachmark (§2.6): -1 once seen, else 0 (rendered only after
  // the sky has loaded — see the render guard below). Lazy init reads the flag once.
  const [coachStep, setCoachStep] = useState(() => {
    try { return localStorage.getItem(COACH_KEY) === '1' ? -1 : 0; } catch { return 0; }
  });

  const dismissCoach = () => {
    try { localStorage.setItem(COACH_KEY, '1'); } catch { /* ignore */ }
    setCoachStep(-1);
  };

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
          <button type="button" onClick={() => setShowInfo(true)} aria-label="What is the Observatory?"
            className="w-8 h-8 rounded-xl flex items-center justify-center text-accent bg-accent/10 border border-accent/30 hover:bg-accent/20 transition-colors">
            <Info size={16} />
          </button>
        </div>

        {/* Explainer (v2 §9.1) */}
        <div className="flex items-start gap-2 p-3 rounded-2xl mb-5 text-xs text-text-secondary"
          style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}>
          <Info size={14} className="mt-0.5 flex-none text-accent" />
          <p>
            <strong className="text-text-primary">The Observatory</strong> is SkillSwap’s hall of fame — a living star
            map of your city’s greatest mentors. The current #1 shines as the <strong>North Star</strong>, the month’s
            biggest climber earns a <strong>Supernova spotlight</strong>, and retired champions become permanent
            <strong> Quasar legends</strong> in the archive.
          </p>
        </div>

        {isLoading && <CosmicLoader variant="observatory" onRetry={refetch} />}
        {isError && <ErrorState message="Failed to load the Observatory." onRetry={refetch} />}

        {!isLoading && !isError && !data?.northStar && (
          <EmptyState icon={<Telescope size={28} />} title="This sky is still dark"
            description="No North Star yet — be the first to shine here. As mentors earn reviews, the brightest will light up the Observatory." />
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

              {/* orbiting mentors — explicit rank numbers (§2.2), "you" highlight (§2.3) */}
              {data.orbiting.map((m, i) => {
                const p = positions[i];
                if (!p) return null;
                const isYou = meId && m.userId === meId;
                return (
                  <button key={m.userId} onClick={() => navigate(`/profile/${m.userId}`)}
                    title={`#${m.rank} · ${m.name} · ${getTier(m.tierId).displayName} · Score ${m.score}`}
                    aria-label={`Rank ${m.rank}, ${m.name}, ${getTier(m.tierId).displayName}, score ${m.score}${isYou ? ', you' : ''}`}
                    className="absolute flex flex-col items-center -translate-x-1/2 -translate-y-1/2 group focus:outline-none"
                    style={{ left: p.x, top: p.y }}>
                    <div className="relative rounded-full"
                      style={isYou ? { boxShadow: '0 0 0 2px var(--accent-1, #00c6ff), 0 0 12px rgba(0,198,255,0.6)' } : undefined}>
                      <CosmicBadge tierId={m.tierId} size={m.rank <= 6 ? 'full' : 'mini'} />
                      <span className="absolute -top-1.5 -left-1.5 min-w-[14px] text-center text-[8px] font-bold px-1 rounded-full leading-[14px]"
                        style={{ background: 'rgba(8,4,20,0.78)', color: '#fff', border: '1px solid rgba(255,255,255,0.22)' }}>
                        {m.rank}
                      </span>
                    </div>
                    {isYou ? (
                      <span className="text-[9px] font-bold mt-0.5" style={{ color: 'var(--accent-1, #00c6ff)' }}>You</span>
                    ) : (
                      <span className="text-[9px] text-text-muted mt-0.5 max-w-[64px] truncate opacity-0 group-hover:opacity-100 transition-opacity">
                        {m.name}
                      </span>
                    )}
                  </button>
                );
              })}

              {/* North Star (center) */}
              {(() => {
                const ns = data.northStar;
                const isYouNorth = meId && ns.userId === meId;
                return (
                  <button onClick={() => navigate(`/profile/${ns.userId}`)}
                    aria-label={`Rank 1, North Star, ${ns.name}, ${getTier(ns.tierId).displayName}, score ${ns.score}${isYouNorth ? ', you' : ''}`}
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center focus:outline-none">
                    {/* §3 — icon + text centered as ONE inline-flex unit, with enough
                        clearance above the 1.5×-scaled badge so it never overlaps the glow. */}
                    <span className="inline-flex items-center justify-center"
                      style={{
                        gap: 6, whiteSpace: 'nowrap', lineHeight: 1, marginBottom: 24,
                        fontSize: 12, letterSpacing: '.14em', fontWeight: 700, color: '#FFD479',
                      }}>
                      <Crown size={14} style={{ display: 'block', flex: '0 0 auto' }} />
                      <span style={{ display: 'inline-block', transform: 'translateY(.5px)' }}>NORTH STAR</span>
                    </span>
                    <div style={{ transform: 'scale(1.5)' }}>
                      <div className="rounded-full"
                        style={isYouNorth ? { boxShadow: '0 0 0 2px var(--accent-1, #00c6ff), 0 0 14px rgba(0,198,255,0.6)' } : undefined}>
                        <CosmicBadge tierId={ns.tierId} size="full" />
                      </div>
                    </div>
                    <span className="text-xs font-bold text-text-primary mt-2">
                      <CosmicName glow={nameGlowFor(ns.tierId)} exploring>{ns.name}</CosmicName>
                      {isYouNorth && <span className="ml-1 font-bold" style={{ color: 'var(--accent-1, #00c6ff)' }}>· You</span>}
                    </span>
                    <span className="text-[10px] text-text-muted inline-flex items-center gap-0.5">
                      {getTier(ns.tierId).displayName}
                      {data.provisional && (
                        <span className="ml-1 opacity-80 inline-flex items-center gap-0.5"
                          onClick={(e) => e.stopPropagation()}>
                          · provisional
                          <InfoDot label="Why provisional?" side="left" size={11}>{PROVISIONAL_TIP}</InfoDot>
                        </span>
                      )}
                    </span>
                  </button>
                );
              })()}
            </div>

            {/* ── "Your standing" chip (§2.3): when the viewer isn't a rendered node ── */}
            {data.you && !data.you.inOrbit && !data.you.isNorthStar && (
              <button onClick={() => navigate('/leaderboard')}
                className="mt-3 mx-auto flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 px-3.5 py-2 rounded-xl text-xs"
                style={{ background: 'var(--surface)', border: '1px solid var(--accent-1, #00c6ff)' }}>
                <span className="font-bold" style={{ color: 'var(--accent-1, #00c6ff)' }}>Your standing</span>
                <span className="text-text-secondary">
                  #{data.you.rank} of {data.you.of} · {getTier(data.you.tierId).displayName} · Score {data.you.score}
                </span>
                <span className="text-accent underline">View on leaderboard</span>
              </button>
            )}

            {/* ── Supernova of the Month = biggest real climber (v3 §3) ── */}
            {data.spotlight ? (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                className="mt-6 p-5 rounded-2xl"
                style={{ background: 'linear-gradient(135deg, rgba(255,107,53,0.08), rgba(255,143,207,0.06))',
                  border: '1px solid rgba(255,107,53,0.2)' }}>
                <div className="flex items-center gap-2 mb-3 text-xs font-bold" style={{ color: '#FF8C42' }}>
                  <Sparkles size={14} /> SUPERNOVA OF THE MONTH
                  <span className="font-normal text-text-muted">· biggest climber this season</span>
                </div>
                <div className="flex items-center gap-4">
                  {/* Their REAL tier badge — never relabeled as Supernova */}
                  <CosmicBadge tierId={data.spotlight.tierId} size="full" />
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-text-primary">{data.spotlight.name}</div>
                    <div className="text-xs text-text-muted">{getTier(data.spotlight.tierId).displayName} · Score {data.spotlight.score}</div>
                    {data.spotlight.climb > 0 && (
                      <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(255,107,53,0.15)', color: '#FF8C42' }}>
                        <TrendingUp size={11} /> Biggest climber this month: +{data.spotlight.climb.toFixed(1)} points
                        {data.spotlight.deltaDivisions > 0 && ` · ${data.spotlight.deltaDivisions} division${data.spotlight.deltaDivisions > 1 ? 's' : ''} climbed`}
                      </span>
                    )}
                  </div>
                </div>
                {data.spotlight.quote && (
                  <div className="mt-3 flex gap-2 text-sm text-text-secondary italic">
                    <Quote size={16} className="flex-none opacity-50" />
                    <span>“{data.spotlight.quote}”{data.spotlight.quoteBy ? <span className="not-italic text-text-muted text-xs"> — {data.spotlight.quoteBy}</span> : null}</span>
                  </div>
                )}
              </motion.div>
            ) : (
              <div className="mt-6 p-5 rounded-2xl text-center"
                style={{ background: 'var(--surface)', border: '1px dashed var(--border-subtle)' }}>
                <div className="flex items-center justify-center gap-2 mb-1.5 text-xs font-bold text-text-secondary">
                  <Sparkles size={14} /> SUPERNOVA OF THE MONTH
                </div>
                <p className="text-xs text-text-muted">
                  The first Supernova of the Month will be crowned as mentors climb this season.
                </p>
              </div>
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
                  No legends yet — the first city champion is enshrined when the season ends.
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Persistent explainer (§2.6) — plain-language definition + score link-outs (§4.5) */}
      <Modal isOpen={showInfo} onClose={() => setShowInfo(false)} title="The Observatory">
        <div className="max-h-[70vh] overflow-y-auto space-y-4 text-sm text-text-secondary leading-relaxed pr-1">
          <p>
            <strong className="text-text-primary">The Observatory</strong> is your city’s night sky of top mentors.
            The <strong>North Star</strong> is the current #1. The brightest mentors orbit closest to it. Each season,
            the biggest climber becomes a <strong>Supernova</strong>, and retired champions are enshrined forever as
            <strong> Quasar legends</strong>. Your own standing is always marked so you can see how close you are to shining.
          </p>
          <p className="text-xs text-text-muted">
            The <strong className="text-text-secondary">Leaderboard</strong> is the precise ranked list (where you are,
            #1…#50). The <strong className="text-text-secondary">Observatory</strong> is the celebration view of that same
            data, as a living star map — same ranking, two views.
          </p>

          <p className="text-xs p-2.5 rounded-xl" style={{ background: 'var(--surface)', border: '1px solid var(--border-subtle)' }}>
            {SCORE_DISTINCTION}
          </p>

          <Disclosure title={COSMIC_SCORE_INFO.title}>
            <ScoreExplainerBody info={COSMIC_SCORE_INFO} />
          </Disclosure>
          <Disclosure title={TRUST_SCORE_INFO.title}>
            <ScoreExplainerBody info={TRUST_SCORE_INFO} />
          </Disclosure>
        </div>
      </Modal>

      {/* One-time 3-step coachmark (§2.6) — dismissible, shown once */}
      {coachStep >= 0 && data?.northStar && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          role="dialog" aria-modal="true" aria-label="Observatory tour">
          <div className="fixed inset-0" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={dismissCoach} aria-hidden="true" />
          <div className="relative w-full max-w-xs rounded-2xl p-5 z-10"
            style={{ background: 'rgba(8,10,22,0.96)', border: '1px solid rgba(0,198,255,0.25)', boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}>
            <div className="flex items-center gap-2 mb-2 text-accent">
              {coachStep === 0 ? <Crown size={16} /> : coachStep === 1 ? <Sparkles size={16} /> : <Star size={16} />}
              <h3 className="font-display font-bold text-text-primary text-base">{COACH_STEPS[coachStep].title}</h3>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed">{COACH_STEPS[coachStep].body}</p>
            <div className="flex items-center justify-between mt-4">
              <div className="flex gap-1.5">
                {COACH_STEPS.map((_, i) => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full"
                    style={{ background: i === coachStep ? 'var(--accent-1, #00c6ff)' : 'var(--border-subtle)' }} />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={dismissCoach} className="text-xs text-text-muted hover:text-text-secondary">Skip</button>
                <button type="button"
                  onClick={() => (coachStep < COACH_STEPS.length - 1 ? setCoachStep(coachStep + 1) : dismissCoach())}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold text-accent bg-accent/10 border border-accent/30 hover:bg-accent/20 transition-colors">
                  {coachStep < COACH_STEPS.length - 1 ? 'Next' : 'Got it'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
