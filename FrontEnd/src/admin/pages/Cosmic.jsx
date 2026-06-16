/**
 * Cosmic — observability over the rank system: the full rank-event log, the
 * Quasar registry + Legends archive, and a per-user CosmicScore inspector with
 * audited recompute / tier-override controls.
 */
import { useCallback, useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Crown, Search, RefreshCw, Loader2 } from 'lucide-react';
import adminApi from '../adminApi';

const TABS = [['events', 'Rank events'], ['quasar', 'Quasar & Legends'], ['inspector', 'Score inspector']];

function RankEvents() {
  const [dir, setDir] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const load = useCallback(() => {
    const p = new URLSearchParams({ page: String(page) });
    if (dir) p.set('direction', dir);
    adminApi.get(`/cosmic/rank-events?${p}`).then((r) => setData(r.data)).catch(() => setData({ rows: [], pages: 1 }));
  }, [dir, page]);
  useEffect(() => { load(); }, [load]);
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {['', 'up', 'down'].map((d) => (
          <button key={d} className={`ssctl-btn ${dir === d ? '' : 'ssctl-btn-ghost'}`} style={{ minHeight: 34, fontSize: 13 }}
            onClick={() => { setPage(1); setDir(d); }}>{d || 'all'}</button>
        ))}
      </div>
      <div className="ssctl-card" style={{ padding: 0 }}>
        <table className="ssctl-table">
          <thead><tr><th>User</th><th>Move</th><th>Dir</th><th>Score</th><th>Trigger</th><th>When</th></tr></thead>
          <tbody>
            {data?.rows.map((e) => (
              <tr key={e._id}>
                <td>{e.userId?.name || '—'}</td>
                <td className="ssctl-muted">{e.fromTierId} → {e.toTierId}</td>
                <td><span className={`ssctl-badge ssctl-badge-${e.direction}`}>{e.direction === 'up' ? <TrendingUp size={11} /> : <TrendingDown size={11} />} {e.direction}</span></td>
                <td className="ssctl-muted">{e.scoreBefore ?? '–'} → {e.scoreAfter ?? '–'}</td>
                <td className="ssctl-muted">{e.trigger}</td>
                <td className="ssctl-muted">{new Date(e.createdAt).toLocaleString()}</td>
              </tr>
            ))}
            {data && data.rows.length === 0 && <tr><td colSpan={6} className="ssctl-muted" style={{ textAlign: 'center', padding: 24 }}>No rank events yet.</td></tr>}
          </tbody>
        </table>
      </div>
      {data && data.pages > 1 && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12, alignItems: 'center' }}>
          <button className="ssctl-btn ssctl-btn-ghost" disabled={page <= 1} style={{ minHeight: 32 }} onClick={() => setPage((p) => p - 1)}>Prev</button>
          <span className="ssctl-muted" style={{ fontSize: 13 }}>{page} / {data.pages}</span>
          <button className="ssctl-btn ssctl-btn-ghost" disabled={page >= data.pages} style={{ minHeight: 32 }} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}

function Quasar() {
  const [data, setData] = useState(null);
  useEffect(() => { adminApi.get('/cosmic/quasar').then((r) => setData(r.data)).catch(() => setData({ legends: [], current: [] })); }, []);
  if (!data) return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="ssctl-spin" /></div>;
  return (
    <div className="ssctl-grid" style={{ gridTemplateColumns: '1fr 1fr', alignItems: 'start' }}>
      <div className="ssctl-card">
        <p className="ssctl-section-title">Current Quasar holders</p>
        {data.current.length === 0 ? <div className="ssctl-muted">None currently.</div> : data.current.map((u) => (
          <div key={u._id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
            <Crown size={16} color="#ec4899" /> <strong>{u.name}</strong>
            <span className="ssctl-muted" style={{ fontSize: 12 }}>{u.city}</span>
          </div>
        ))}
      </div>
      <div className="ssctl-card">
        <p className="ssctl-section-title">Legends archive ({data.legends.length})</p>
        <table className="ssctl-table">
          <thead><tr><th>Star</th><th>Holder</th><th>City</th><th>Season</th></tr></thead>
          <tbody>
            {data.legends.map((l) => (
              <tr key={l._id}><td>{l.starName || '—'}</td><td>{l.userId?.name || '—'}</td><td className="ssctl-muted">{l.city}</td><td className="ssctl-muted">{l.seasonId}</td></tr>
            ))}
            {data.legends.length === 0 && <tr><td colSpan={4} className="ssctl-muted" style={{ textAlign: 'center', padding: 20 }}>No legends archived yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Inspector() {
  const [uid, setUid] = useState('');
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');

  const inspect = async (id) => {
    setErr(''); setData(null);
    try { const r = await adminApi.get(`/cosmic/score/${id}`); setData(r.data); }
    catch (e) { setErr(e?.response?.data?.message || 'Not found'); }
  };
  const recompute = async () => {
    setBusy('recompute');
    try { await adminApi.post(`/cosmic/score/${data.user.id}/recompute`); await inspect(data.user.id); }
    catch (e) { setErr(e?.response?.data?.message || 'Failed'); } finally { setBusy(''); }
  };
  const override = async () => {
    const tierId = prompt('Override to tierId (e.g. pulsar_2):');
    if (!tierId) return;
    const reason = prompt('Reason (required, audited):');
    if (!reason) return;
    setBusy('override');
    try { await adminApi.post(`/cosmic/score/${data.user.id}/override`, { tierId, reason }); await inspect(data.user.id); }
    catch (e) { setErr(e?.response?.data?.message || 'Failed'); } finally { setBusy(''); }
  };

  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); if (uid.trim()) inspect(uid.trim()); }} style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={15} style={{ position: 'absolute', left: 11, top: 12, color: 'var(--ss-text-dim)' }} />
          <input className="ssctl-input" style={{ paddingLeft: 34 }} placeholder="Paste a user ID to inspect…" value={uid} onChange={(e) => setUid(e.target.value)} />
        </div>
        <button className="ssctl-btn">Inspect</button>
      </form>
      {err && <p className="ssctl-err">{err}</p>}
      {data && (
        <div className="ssctl-grid" style={{ gridTemplateColumns: '1fr 1fr', alignItems: 'start' }}>
          <div className="ssctl-card">
            <p className="ssctl-section-title">{data.user.name} — live compute</p>
            <p style={{ fontSize: 13 }}>Score <strong>{data.live.score}</strong> · Tier <strong>{data.live.displayName}</strong> ({data.live.tierId})</p>
            <p style={{ fontSize: 13 }} className="ssctl-muted">Weighted reviews {data.live.weightedReviews} · Anchor {data.live.anchorTier} · {data.live.hysteresis}</p>
            {data.live.gated && <p className="ssctl-err" style={{ fontSize: 13 }}>Gated: {data.live.gateReason}</p>}
            <p style={{ fontSize: 13 }} className="ssctl-muted">Inputs: {data.inputs.ratingsCount} ratings · {data.inputs.completedSwaps} swaps</p>
            <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
              <button className="ssctl-btn ssctl-btn-ghost" style={{ minHeight: 36, fontSize: 13 }} disabled={!!busy} onClick={recompute}>
                {busy === 'recompute' ? <Loader2 size={13} /> : <RefreshCw size={13} />} Recompute & persist
              </button>
              <button className="ssctl-btn ssctl-btn-ghost" style={{ minHeight: 36, fontSize: 13 }} disabled={!!busy} onClick={override}>
                Override tier…
              </button>
            </div>
          </div>
          <div className="ssctl-card">
            <p className="ssctl-section-title">Stored vs history</p>
            <p style={{ fontSize: 13 }} className="ssctl-muted">Stored tier {data.stored?.tierId} · peak {data.stored?.peakTierId} · score {data.stored?.score}</p>
            <table className="ssctl-table" style={{ marginTop: 8 }}>
              <thead><tr><th>Move</th><th>Dir</th><th>When</th></tr></thead>
              <tbody>
                {data.history.map((h) => (
                  <tr key={h._id}><td className="ssctl-muted">{h.fromTierId} → {h.toTierId}</td><td><span className={`ssctl-badge ssctl-badge-${h.direction}`}>{h.direction}</span></td><td className="ssctl-muted">{new Date(h.createdAt).toLocaleDateString()}</td></tr>
                ))}
                {data.history.length === 0 && <tr><td colSpan={3} className="ssctl-muted" style={{ textAlign: 'center', padding: 16 }}>No history.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Cosmic() {
  const [tab, setTab] = useState('events');
  return (
    <div>
      <h1 className="ssctl-h1">Cosmic observability</h1>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {TABS.map(([id, label]) => (
          <button key={id} className={`ssctl-btn ${tab === id ? '' : 'ssctl-btn-ghost'}`} style={{ minHeight: 36, fontSize: 13 }} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {tab === 'events' && <RankEvents />}
      {tab === 'quasar' && <Quasar />}
      {tab === 'inspector' && <Inspector />}
    </div>
  );
}
