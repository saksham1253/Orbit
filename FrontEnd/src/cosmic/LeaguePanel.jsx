/**
 * LeaguePanel — the Weekly League standings on the /orbit hub (Tier 2b).
 *
 * Shows the viewer's division, last week's promotion/relegation result, a
 * countdown to the Monday-UTC reset, and the live group leaderboard ranked by
 * this week's Orbit XP with promote (top) / relegate (bottom) zones highlighted.
 */
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Swords, ChevronUp, ChevronDown, Zap, Trophy } from 'lucide-react';
import Avatar from '../components/common/Avatar';
import { useLeague } from './useLeague';

function useCountdown(iso) {
  const [txt, setTxt] = useState('');
  useEffect(() => {
    if (!iso) return;
    const tick = () => {
      const ms = new Date(iso) - new Date();
      if (ms <= 0) { setTxt('rolling over…'); return; }
      const d = Math.floor(ms / 86400000);
      const h = Math.floor((ms % 86400000) / 3600000);
      setTxt(d > 0 ? `${d}d ${h}h` : `${h}h`);
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [iso]);
  return txt;
}

const ZONE_ROW = {
  promote:  'bg-emerald-500/10',
  relegate: 'bg-rose-500/10',
  hold:     '',
};

const RESULT_CHIP = {
  promoted:  { text: 'Promoted last week', cls: 'text-emerald-300 bg-emerald-500/10 ring-emerald-400/30' },
  relegated: { text: 'Relegated last week', cls: 'text-rose-300 bg-rose-500/10 ring-rose-400/30' },
  held:      { text: 'Held last week', cls: 'text-slate-300 bg-white/5 ring-white/10' },
};

export default function LeaguePanel() {
  const { data, isLoading } = useLeague();
  const countdown = useCountdown(data?.resetsAtUTC);
  if (isLoading || !data) return null;

  const { division, standings = [], you, promoteCount, relegateCount, lastResult } = data;
  const chip = RESULT_CHIP[lastResult];

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/30 p-4">
      <div className="flex items-center gap-2 mb-1">
        <Swords size={18} style={{ color: division.color }} />
        <h2 className="text-base font-bold text-white">Weekly League</h2>
        <span className="ml-auto text-xs text-slate-400">resets in {countdown}</span>
      </div>

      {/* Division header */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ring-1"
          style={{ color: division.color, borderColor: division.color, boxShadow: `0 0 10px ${division.color}33` }}
        >
          <Trophy size={14} /> {division.name}
        </span>
        {chip && <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ring-1 ${chip.cls}`}>{chip.text}</span>}
        {you && (
          <span className="ml-auto text-xs text-slate-400">
            You’re <b className="text-white">#{you.rank}</b> · <span className="text-amber-300">{you.weekXp} XP</span>
          </span>
        )}
      </div>

      {/* Standings */}
      <div className="rounded-xl border border-white/10 overflow-hidden divide-y divide-white/5">
        {standings.map((m) => (
          <motion.div
            key={m.userId}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`flex items-center gap-3 px-3 py-2 ${ZONE_ROW[m.zone]} ${m.isMe ? 'ring-1 ring-inset ring-amber-400/40' : ''}`}
          >
            <span className="w-6 text-center text-sm font-bold tabular-nums text-slate-400">{m.rank}</span>
            {m.zone === 'promote' && <ChevronUp size={14} className="text-emerald-400 shrink-0" />}
            {m.zone === 'relegate' && <ChevronDown size={14} className="text-rose-400 shrink-0" />}
            {m.zone === 'hold' && <span className="w-[14px] shrink-0" />}
            <Avatar name={m.name} url={m.avatar} size="xs" userId={m.userId} />
            <span className={`flex-1 text-sm truncate ${m.isMe ? 'font-bold text-white' : 'text-slate-200'}`}>
              {m.name}{m.isMe && ' (you)'}
            </span>
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-amber-300 tabular-nums">
              <Zap size={12} /> {m.weekXp}
            </span>
          </motion.div>
        ))}
      </div>

      <p className="text-[11px] text-slate-500 mt-2">
        Top {promoteCount} promote · bottom {relegateCount} relegate. Earn XP: swap +30, review +15, message +5, mission +40.
      </p>
    </section>
  );
}
