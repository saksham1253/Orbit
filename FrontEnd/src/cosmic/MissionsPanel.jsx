/**
 * MissionsPanel — the week's 3 rotating Orbit missions with progress bars and
 * claim buttons. Reads the shared ['orbit','me'] query and claims via the Orbit
 * API; a claimed mission pays Photons (handled server-side).
 */
import { motion } from 'framer-motion';
import { Target, Check, Sparkles } from 'lucide-react';
import { useClaimMission } from './useOrbit';
import { useUIStore } from '../store/uiStore';

function MissionCard({ m, onClaim, claiming }) {
  const pct = Math.min(100, Math.round((m.progress / m.target) * 100));
  const claimable = m.complete && !m.claimed;
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/40 p-3.5 flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-white">{m.label}</div>
          <div className="text-xs text-slate-400">{m.description}</div>
        </div>
        <span className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-violet-300">
          <Sparkles size={13} /> {m.photons ?? m.stardust}
        </span>
      </div>

      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-violet-400"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs tabular-nums text-slate-400">{Math.min(m.progress, m.target)}/{m.target}</span>
        {m.claimed ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
            <Check size={14} /> Claimed
          </span>
        ) : (
          <button
            onClick={() => onClaim(m.key)}
            disabled={!claimable || claiming}
            className={`rounded-full px-3 py-1 text-xs font-bold transition
              ${claimable
                ? 'bg-gradient-to-r from-amber-400 to-violet-500 text-slate-900 hover:brightness-110'
                : 'bg-white/5 text-slate-500 cursor-not-allowed'}`}
          >
            {claimable ? 'Claim' : `${pct}%`}
          </button>
        )}
      </div>
    </div>
  );
}

export default function MissionsPanel({ missions = [] }) {
  const claim = useClaimMission();
  const { addToast } = useUIStore();

  const onClaim = (key) => {
    claim.mutate(key, {
      onSuccess: (data) => addToast(`+${data.awardedPhotons ?? data.awarded} Photons claimed! ✨`, 'success'),
      onError: (e) => addToast(e.response?.data?.message || 'Could not claim mission', 'error'),
    });
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/30 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Target size={18} className="text-amber-300" />
        <h2 className="text-base font-bold text-white">Weekly Missions</h2>
        <span className="ml-auto text-xs text-slate-400">resets Monday · UTC</span>
      </div>
      {missions.length === 0 ? (
        <p className="text-sm text-slate-400">New missions are being charted…</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          {missions.map((m) => (
            <MissionCard key={m.key} m={m} onClaim={onClaim} claiming={claim.isPending} />
          ))}
        </div>
      )}
    </section>
  );
}
