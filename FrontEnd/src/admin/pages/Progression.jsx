/**
 * Progression — streaks + ranking module (spec F + G). Two tabs:
 *   • Support — look up a user's streak/freeze/league/cosmic; adjust or restore a
 *               streak and grant Gravity Assist freeze tokens (audited, reason
 *               required). Touches only orbit fields — never rank.
 *   • Config  — a live, consolidated view of the progression tuning (streak
 *               milestones, phases, Gravity Assist economics, CosmicScore weights,
 *               league rules). Gravity-Assist economics are editable in Economy →
 *               Earn Rules; the rest are shown as live reference.
 */
import { useCallback, useEffect, useState } from 'react';
import { Search, Save, Snowflake } from 'lucide-react';
import adminApi from '../adminApi';
import useToast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';

function Support({ toast }) {
  const [q, setQ] = useState('');
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [cur, setCur] = useState('');
  const [freezeN, setFreezeN] = useState('');
  const [modal, setModal] = useState(null); // { kind: 'streak'|'freeze' }
  const [busy, setBusy] = useState(false);

  const lookup = useCallback(async (id) => {
    setErr(''); setData(null);
    if (!id.trim()) return;
    try {
      const r = await adminApi.get(`/progression/user/${encodeURIComponent(id.trim())}`);
      setData(r.data); setCur(String(r.data.streak?.current ?? ''));
    } catch (e) { setErr(e.response?.data?.message || 'Lookup failed (need a valid user id).'); }
  }, []);

  const run = async (reason) => {
    setBusy(true);
    try {
      if (modal.kind === 'streak') {
        await adminApi.post(`/progression/user/${data.user._id}/streak`, { current: Number(cur), reason });
        toast.push('Streak updated', 'success');
      } else {
        await adminApi.post(`/progression/user/${data.user._id}/freeze`, { tokens: Number(freezeN), reason });
        toast.push('Freeze tokens granted', 'success');
      }
      setModal(null); setFreezeN(''); lookup(data.user._id);
    } catch (e) { toast.push(e.response?.data?.message || 'Failed', 'error'); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <input className="ssctl-input" style={{ maxWidth: 340 }} placeholder="User id" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && lookup(q)} />
        <button className="ssctl-btn" style={{ minHeight: 40 }} onClick={() => lookup(q)}><Search size={14} /> Look up</button>
      </div>
      {err && <div className="ssctl-err">{err}</div>}
      {data && (
        <div className="ssctl-card">
          <div style={{ fontWeight: 600 }}>{data.user.name} <span className="ssctl-muted" style={{ fontWeight: 400, fontSize: 12 }}>· {data.user.email}</span></div>
          <div className="ssctl-grid" style={{ margin: '12px 0' }}>
            <div className="ssctl-kpi"><div className="ssctl-muted" style={{ fontSize: 12 }}>Streak</div><div style={{ fontSize: 20, fontWeight: 700 }}>{data.streak?.current ?? 0}d</div></div>
            <div className="ssctl-kpi"><div className="ssctl-muted" style={{ fontSize: 12 }}>Longest</div><div style={{ fontSize: 20, fontWeight: 700 }}>{data.streak?.longest ?? 0}d</div></div>
            <div className="ssctl-kpi"><div className="ssctl-muted" style={{ fontSize: 12 }}>Freeze tokens</div><div style={{ fontSize: 20, fontWeight: 700 }}>{data.freeze?.tokens ?? 0}</div></div>
            <div className="ssctl-kpi"><div className="ssctl-muted" style={{ fontSize: 12 }}>Division</div><div style={{ fontSize: 20, fontWeight: 700 }}>{data.league?.divisionId ?? '—'}</div></div>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label className="ssctl-label">Set streak (days)
              <div style={{ display: 'flex', gap: 6 }}>
                <input className="ssctl-input" style={{ width: 100 }} type="number" min="0" value={cur} onChange={(e) => setCur(e.target.value)} />
                <button className="ssctl-btn" style={{ minHeight: 40 }} disabled={cur === ''} onClick={() => setModal({ kind: 'streak' })}><Save size={14} /> Apply</button>
              </div>
            </label>
            <label className="ssctl-label">Grant freeze (±)
              <div style={{ display: 'flex', gap: 6 }}>
                <input className="ssctl-input" style={{ width: 90 }} type="number" value={freezeN} onChange={(e) => setFreezeN(e.target.value)} />
                <button className="ssctl-btn" style={{ minHeight: 40 }} disabled={!parseInt(freezeN, 10)} onClick={() => setModal({ kind: 'freeze' })}><Snowflake size={14} /> Grant</button>
              </div>
            </label>
          </div>
        </div>
      )}
      <ConfirmModal
        open={!!modal}
        title={modal?.kind === 'streak' ? `Set streak to ${cur} days` : `Grant ${freezeN} freeze token(s)`}
        message={`For ${data?.user?.name}. Affects only their streak/freeze — never rank. Audited.`}
        requireReason busy={busy}
        onConfirm={run} onClose={() => setModal(null)}
      />
    </div>
  );
}

function Group({ title, editable, children }) {
  return (
    <div className="ssctl-card" style={{ marginBottom: 12 }}>
      <div className="ssctl-section-title" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {title}
        <span className={`ssctl-badge-${editable ? 'active' : 'role'}`} style={{ fontSize: 10 }}>{editable ? 'editable in Economy' : 'live reference'}</span>
      </div>
      <div style={{ marginTop: 8 }}>{children}</div>
    </div>
  );
}

function Config() {
  const [c, setC] = useState(null);
  useEffect(() => { adminApi.get('/progression/config').then((r) => setC(r.data)).catch(() => setC(null)); }, []);
  if (!c) return <div className="ssctl-muted">Loading…</div>;
  return (
    <div>
      <Group title="Streak milestones" editable={false}>
        <table className="ssctl-table"><thead><tr><th>Days</th><th>Name</th><th>Photons</th></tr></thead>
          <tbody>{c.streaks.milestones.map((m) => <tr key={m.days}><td>{m.days}</td><td>{m.name}</td><td>{m.stardust}</td></tr>)}</tbody>
        </table>
      </Group>
      <Group title="Gravity Assist (streak-freeze)" editable={c.gravityAssist.editable}>
        <div className="ssctl-muted" style={{ fontSize: 13 }}>Cap {c.gravityAssist.cap} · Weekly grant {c.gravityAssist.weeklyGrant} · Cost {c.gravityAssist.cost} Photons</div>
      </Group>
      <Group title="CosmicScore weights" editable={false}>
        <div className="ssctl-muted" style={{ fontSize: 13 }}>{Object.entries(c.ranking.cosmicWeights).map(([k, v]) => `${k}: ${v}`).join(' · ')}</div>
      </Group>
      <Group title="Weekly League" editable={false}>
        <div className="ssctl-muted" style={{ fontSize: 13 }}>{c.leagues.divisions.length} divisions · group size {c.leagues.groupSize} · promote {c.leagues.promoteCount} · relegate {c.leagues.relegateCount}</div>
      </Group>
    </div>
  );
}

export default function Progression() {
  const [tab, setTab] = useState('support');
  const toast = useToast();
  return (
    <div>
      <h1 className="ssctl-h1">Progression</h1>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[['support', 'Support Tools'], ['config', 'Config']].map(([id, label]) => (
          <button key={id} className={`ssctl-btn ${tab === id ? '' : 'ssctl-btn-ghost'}`} style={{ minHeight: 36, fontSize: 13 }} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {tab === 'support' ? <Support toast={toast} /> : <Config />}
      {toast.Toasts}
    </div>
  );
}
