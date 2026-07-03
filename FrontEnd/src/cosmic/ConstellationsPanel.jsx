/**
 * ConstellationsPanel — co-op Binary Star streaks on the /orbit hub.
 *
 * Shows active constellations (partner + shared flame + state), incoming and
 * outgoing invites, and a partner picker (fed by the viewer's connections) to
 * form new Binary Stars. Reads ['orbit','constellations'] and mutates via the
 * constellation API.
 */
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Flame, Shield, UserPlus, Check, X, Star } from 'lucide-react';
import Avatar from '../components/common/Avatar';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import {
  useConstellations, useConnectionsForInvite,
  useInviteConstellation, useRespondConstellation, useDissolveConstellation,
} from './useConstellations';

const STATE_COPY = {
  active:   { color: '#fbbf24', text: 'Both showed up today' },
  waiting:  { color: '#60a5fa', text: 'Waiting on your partner' },
  decaying: { color: '#fb7185', text: 'Decaying — you both need to act' },
  idle:     { color: '#94a3b8', text: 'Starts when you both act on the same day' },
};

function ActiveCard({ c, onDissolve, dissolving }) {
  const st = STATE_COPY[c.streak.state] || STATE_COPY.idle;
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/40 p-3.5 flex items-center gap-3">
      <Avatar name={c.partner?.name} url={c.partner?.avatar} size="sm" userId={c.partner?.id} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-white truncate">{c.partner?.name || 'Partner'}</div>
        <div className="text-xs" style={{ color: st.color }}>{st.text}</div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="inline-flex items-center gap-1 text-sm font-bold" style={{ color: st.color }}>
          <Flame size={15} /> {c.streak.current}
        </span>
        {c.freeze.tokens > 0 && (
          <span className="inline-flex items-center gap-0.5 text-xs text-sky-300" title="Shared Gravity Assist">
            <Shield size={12} /> {c.freeze.tokens}
          </span>
        )}
        <button
          onClick={() => onDissolve(c.id)}
          disabled={dissolving}
          className="text-slate-500 hover:text-rose-400 transition-colors"
          title="Dissolve Binary Star"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
}

export default function ConstellationsPanel() {
  const { data } = useConstellations();
  const me = useAuthStore((s) => s.user);
  const { addToast } = useUIStore();
  const [pickerOpen, setPickerOpen] = useState(false);

  const invite = useInviteConstellation();
  const respond = useRespondConstellation();
  const dissolve = useDissolveConstellation();
  const { data: connections = [] } = useConnectionsForInvite(pickerOpen);

  // Partners already in an active/pending constellation → excluded from picker.
  const takenIds = useMemo(() => {
    const ids = new Set();
    for (const c of [...(data?.active || []), ...(data?.incoming || []), ...(data?.outgoing || [])]) {
      if (c.partner?.id) ids.add(c.partner.id);
    }
    return ids;
  }, [data]);

  const eligible = useMemo(() => {
    const myId = me?._id?.toString();
    const seen = new Set();
    const out = [];
    for (const conn of connections) {
      const other = conn.requester?._id?.toString() === myId ? conn.receiver : conn.requester;
      const oid = other?._id?.toString();
      if (!oid || seen.has(oid) || takenIds.has(oid)) continue;
      seen.add(oid);
      out.push({ id: oid, name: other.name, avatar: other.avatar });
    }
    return out;
  }, [connections, me, takenIds]);

  const onInvite = (partnerId) => invite.mutate(partnerId, {
    onSuccess: () => { addToast('Binary Star invite sent ✨', 'success'); setPickerOpen(false); },
    onError: (e) => addToast(e.response?.data?.message || 'Could not send invite', 'error'),
  });
  const onRespond = (id, action) => respond.mutate({ id, action }, {
    onSuccess: () => addToast(action === 'accept' ? 'Binary Star formed 🌟' : 'Invite declined', action === 'accept' ? 'success' : 'info'),
    onError: (e) => addToast(e.response?.data?.message || 'Action failed', 'error'),
  });
  const onDissolve = (id) => dissolve.mutate(id, {
    onSuccess: () => addToast('Binary Star dissolved', 'info'),
    onError: (e) => addToast(e.response?.data?.message || 'Could not dissolve', 'error'),
  });

  const active = data?.active || [];
  const incoming = data?.incoming || [];
  const outgoing = data?.outgoing || [];

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-900/30 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Users size={18} className="text-violet-300" />
        <h2 className="text-base font-bold text-white">Constellations</h2>
        <span className="hidden sm:inline text-xs text-slate-500">shared streaks with partners</span>
        <button
          onClick={() => setPickerOpen((v) => !v)}
          className="ml-auto inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold bg-violet-500/15 text-violet-200 ring-1 ring-violet-400/30 hover:bg-violet-500/25"
        >
          <UserPlus size={13} /> Pair up
        </button>
      </div>

      {/* Partner picker */}
      {pickerOpen && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mb-3 overflow-hidden">
          <div className="rounded-xl border border-white/10 bg-slate-950/40 p-2 max-h-56 overflow-y-auto">
            {eligible.length === 0 ? (
              <p className="text-xs text-slate-400 p-2">No eligible partners yet — connect with someone first (accepted or completed swap).</p>
            ) : eligible.map((p) => (
              <div key={p.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/5">
                <Avatar name={p.name} url={p.avatar} size="xs" userId={p.id} />
                <span className="flex-1 text-sm text-white truncate">{p.name}</span>
                <button
                  onClick={() => onInvite(p.id)}
                  disabled={invite.isPending}
                  className="rounded-full px-2.5 py-1 text-xs font-bold bg-violet-500 text-white hover:brightness-110 disabled:opacity-50"
                >
                  Invite
                </button>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Incoming invites */}
      {incoming.map((c) => (
        <div key={c.id} className="mb-2 rounded-xl border border-violet-400/30 bg-violet-500/10 p-3 flex items-center gap-3">
          <Star size={16} className="text-violet-300 shrink-0" />
          <div className="flex-1 min-w-0 text-sm text-white">
            <b>{c.partner?.name || 'Someone'}</b> invited you to a Binary Star
          </div>
          <button onClick={() => onRespond(c.id, 'accept')} disabled={respond.isPending}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold bg-emerald-500 text-white hover:brightness-110">
            <Check size={13} /> Accept
          </button>
          <button onClick={() => onRespond(c.id, 'decline')} disabled={respond.isPending}
            className="rounded-full px-2 py-1 text-xs font-semibold text-slate-300 hover:text-rose-300">
            Decline
          </button>
        </div>
      ))}

      {/* Active constellations */}
      {active.length > 0 && (
        <div className="grid gap-2.5">
          {active.map((c) => <ActiveCard key={c.id} c={c} onDissolve={onDissolve} dissolving={dissolve.isPending} />)}
        </div>
      )}

      {/* Outgoing (pending) */}
      {outgoing.map((c) => (
        <div key={c.id} className="mt-2 flex items-center gap-2 text-xs text-slate-400">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-400/70 animate-pulse" />
          Invite to <b className="text-slate-300">{c.partner?.name || 'partner'}</b> pending…
          <button onClick={() => onDissolve(c.id)} className="ml-auto hover:text-rose-300">Cancel</button>
        </div>
      ))}

      {active.length === 0 && incoming.length === 0 && outgoing.length === 0 && !pickerOpen && (
        <p className="text-sm text-slate-400">
          Pair with a partner to start a <b className="text-violet-300">Binary Star</b> — a shared streak you both keep alive. Milestones pay Stardust to both of you.
        </p>
      )}
    </section>
  );
}
