/**
 * Orbit — the engagement hub (Tier‑1: streak + Gravity Assist + missions).
 *
 * Shows the live Orbit streak (with decay framing + a countdown to the UTC
 * reset), the milestone ladder, the Gravity Assist freeze inventory (buyable
 * with Stardust), the Stardust wallet, and this week's rotating missions.
 * Read-only data comes from ['orbit','me']; claims/purchases mutate it.
 */
import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { Flame, Shield, Sparkles, Rocket, Clock, Trophy } from 'lucide-react';
import { useOrbit, useBuyFreeze } from '../cosmic/useOrbit';
import MissionsPanel from '../cosmic/MissionsPanel';
import ConstellationsPanel from '../cosmic/ConstellationsPanel';
import LeaguePanel from '../cosmic/LeaguePanel';
import ShopPanel from '../cosmic/ShopPanel';
import CosmicLoader from '../cosmic/CosmicLoader';
import ErrorState from '../components/common/ErrorState';
import { useUIStore } from '../store/uiStore';

// Live "time until midnight UTC" countdown.
function useUtcCountdown() {
  const [txt, setTxt] = useState('');
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
      const ms = end - now;
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      setTxt(`${h}h ${m}m`);
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, []);
  return txt;
}

const STATE_COPY = {
  active:   { ring: '#fbbf24', label: 'Orbit stable', sub: "You've stayed in orbit today." },
  decaying: { ring: '#fb7185', label: 'Orbit decaying', sub: 'Do 1 swap, message, or review to stay in orbit.' },
  idle:     { ring: '#64748b', label: 'No orbit yet', sub: 'Take any action to enter orbit.' },
};

function StreakRing({ current, next, ringColor }) {
  const target = next ? next.days : Math.max(current, 1);
  const pct = Math.min(1, current / target);
  const R = 54, C = 2 * Math.PI * R;
  return (
    <div className="relative w-36 h-36 shrink-0">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="8" />
        <motion.circle
          cx="60" cy="60" r={R} fill="none" stroke={ringColor} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - pct) }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 6px ${ringColor})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <Flame size={20} style={{ color: ringColor }} />
        <span className="text-3xl font-black text-white tabular-nums leading-none mt-1">{current}</span>
        <span className="text-[11px] uppercase tracking-wide text-slate-400">day orbit</span>
      </div>
    </div>
  );
}

export default function Orbit() {
  const { data, isLoading, isError, refetch } = useOrbit();
  const buyFreeze = useBuyFreeze();
  const { addToast } = useUIStore();
  const countdown = useUtcCountdown();

  if (isLoading) return <CosmicLoader />;
  if (isError || !data) return <ErrorState onRetry={refetch} message="Couldn't load your Orbit." />;

  const { streak, freeze, stardust, missions, nextMilestone, milestones } = data;
  const copy = STATE_COPY[streak.state] || STATE_COPY.idle;

  const onBuyFreeze = () => {
    buyFreeze.mutate(undefined, {
      onSuccess: () => addToast('Gravity Assist banked 🛡️', 'success'),
      onError: (e) => addToast(e.response?.data?.message || 'Could not buy a freeze', 'error'),
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
      <Helmet><title>Orbit · Your Streak</title></Helmet>

      <div className="flex items-center gap-2">
        <Rocket size={22} className="text-amber-300" />
        <h1 className="text-xl font-black text-white">Orbit</h1>
      </div>

      {/* Hero: streak ring + state + countdown */}
      <section className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/60 to-violet-950/30 p-5">
        <div className="flex flex-col sm:flex-row items-center gap-5">
          <StreakRing current={streak.current} next={nextMilestone} ringColor={copy.ring} />
          <div className="flex-1 text-center sm:text-left">
            <div className="text-lg font-bold" style={{ color: copy.ring }}>{copy.label}</div>
            <p className="text-sm text-slate-300 mt-0.5">{copy.sub}</p>
            <div className="flex flex-wrap justify-center sm:justify-start gap-4 mt-3 text-sm">
              <span className="text-slate-400">Longest <b className="text-white">{streak.longest}</b></span>
              {nextMilestone && (
                <span className="text-slate-400">
                  Next: <b className="text-white">{nextMilestone.name}</b> at {nextMilestone.days}d
                </span>
              )}
              {streak.state !== 'active' && (
                <span className="inline-flex items-center gap-1 text-rose-300">
                  <Clock size={14} /> resets in {countdown}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Wallet + Gravity Assist */}
      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-2xl border border-white/10 bg-slate-900/30 p-4 flex items-center gap-3">
          <Sparkles size={26} className="text-violet-300" />
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-400">Stardust</div>
            <div className="text-2xl font-black text-white tabular-nums">{stardust}</div>
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-900/30 p-4">
          <div className="flex items-center gap-3">
            <Shield size={26} className="text-sky-300" />
            <div className="flex-1">
              <div className="text-xs uppercase tracking-wide text-slate-400">Gravity Assist</div>
              <div className="text-2xl font-black text-white tabular-nums">
                {freeze.tokens}<span className="text-sm text-slate-500">/{freeze.cap}</span>
              </div>
            </div>
            <button
              onClick={onBuyFreeze}
              disabled={buyFreeze.isPending || freeze.tokens >= freeze.cap || stardust < freeze.costStardust}
              className="rounded-full px-3 py-1.5 text-xs font-bold bg-white/5 text-sky-200 ring-1 ring-sky-400/30
                         enabled:hover:bg-sky-400/10 disabled:opacity-40 disabled:cursor-not-allowed"
              title={freeze.tokens >= freeze.cap ? 'Inventory full' : `Costs ${freeze.costStardust} Stardust`}
            >
              +1 · {freeze.costStardust} ✨
            </button>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Auto-used to bridge a missed day so a long streak survives. One free each week.
          </p>
        </section>
      </div>

      {/* Missions */}
      <MissionsPanel missions={missions} />

      {/* Weekly League — promotion/relegation by fresh weekly Orbit XP */}
      <LeaguePanel />

      {/* Constellations — co-op Binary Star streaks */}
      <ConstellationsPanel />

      {/* Stardust Cosmetics Shop — the spend side of the economy */}
      <ShopPanel />

      {/* Milestone ladder */}
      <section className="rounded-2xl border border-white/10 bg-slate-900/30 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Trophy size={18} className="text-amber-300" />
          <h2 className="text-base font-bold text-white">Orbit Milestones</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          {milestones.map((m) => {
            const reached = streak.longest >= m.days;
            return (
              <div
                key={m.days}
                className={`rounded-xl px-3 py-2 text-center ring-1 min-w-[92px]
                  ${reached ? 'bg-amber-400/10 ring-amber-400/40' : 'bg-white/5 ring-white/10'}`}
              >
                <div className={`text-sm font-bold ${reached ? 'text-amber-300' : 'text-slate-300'}`}>{m.name}</div>
                <div className="text-[11px] text-slate-400">{m.days}d · {m.stardust}✨</div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
