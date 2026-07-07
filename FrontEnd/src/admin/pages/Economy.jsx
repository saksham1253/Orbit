/**
 * Economy — the Photons economy module (spec A). Three tabs:
 *   • Supply    — circulating Photons, holders, faucets vs sinks, inflation flag.
 *   • Ledger    — look up a user's balance + full earn/spend ledger; grant/deduct.
 *   • Earn Rules— edit the (overlay-backed) economy config; reset to default.
 *
 * Grants/deductions and config edits require the "economy" portal role server-
 * side; every mutation is audited. Photons never touch rank — enforced server-side.
 */
import { useCallback, useEffect, useState } from 'react';
import { Coins, Search, Plus, Minus, RotateCcw } from 'lucide-react';
import adminApi from '../adminApi';
import useToast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';

function Kpi({ label, value }) {
  return (
    <div className="ssctl-kpi">
      <div className="ssctl-muted" style={{ fontSize: 12 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function Supply() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => {
    adminApi.get('/economy/summary').then((r) => setData(r.data)).catch(() => setErr('Failed to load summary.'));
  }, []);
  if (err) return <div className="ssctl-err">{err}</div>;
  if (!data) return <div className="ssctl-muted">Loading…</div>;
  const l = data.ledger || {};
  return (
    <div>
      <div className="ssctl-grid" style={{ marginBottom: 16 }}>
        <Kpi label="Circulating Photons" value={Number(data.circulating).toLocaleString()} />
        <Kpi label="Holders" value={Number(data.holders).toLocaleString()} />
        <Kpi label="Avg balance" value={Number(data.avgBalance).toLocaleString()} />
        <Kpi label="Net supply (ledger)" value={Number(l.net ?? 0).toLocaleString()} />
      </div>
      <div className="ssctl-card">
        <div className="ssctl-section-title" style={{ marginBottom: 8 }}>Faucets vs Sinks</div>
        <table className="ssctl-table">
          <thead><tr><th>Direction</th><th>Photons</th></tr></thead>
          <tbody>
            <tr><td className="ssctl-muted">Earned (faucets)</td><td>{Number(l.sources ?? 0).toLocaleString()}</td></tr>
            <tr><td className="ssctl-muted">Spent (sinks)</td><td>{Number(l.sinks ?? 0).toLocaleString()}</td></tr>
            <tr><td className="ssctl-muted">Inflation flag</td><td>{l.inflation ? 'YES — faucets outpacing sinks' : 'no'}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Ledger({ toast }) {
  const [q, setQ] = useState('');
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [modal, setModal] = useState(null); // { sign: +1|-1 }
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState('');

  const lookup = useCallback(async (userId) => {
    setErr(''); setData(null);
    if (!userId.trim()) return;
    try {
      const r = await adminApi.get(`/economy/ledger?userId=${encodeURIComponent(userId.trim())}`);
      setData(r.data);
    } catch (e) {
      setErr(e.response?.data?.message || 'Lookup failed (need a valid user id).');
    }
  }, []);

  const doAdjust = async (reason) => {
    const amt = parseInt(amount, 10) * (modal.sign);
    setBusy(true);
    try {
      await adminApi.post('/economy/adjust', { userId: data.user._id, amount: amt, reason });
      toast.push(`${amt >= 0 ? 'Granted' : 'Deducted'} ${Math.abs(amt).toLocaleString()} Photons`, 'success');
      setModal(null); setAmount('');
      lookup(data.user._id);
    } catch (e) {
      toast.push(e.response?.data?.message || 'Adjustment failed', 'error');
    } finally { setBusy(false); }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <input className="ssctl-input" style={{ maxWidth: 340 }} placeholder="User id" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && lookup(q)} />
        <button className="ssctl-btn" style={{ minHeight: 40 }} onClick={() => lookup(q)}><Search size={14} /> Look up</button>
      </div>
      {err && <div className="ssctl-err">{err}</div>}
      {data && (
        <>
          <div className="ssctl-card" style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 600 }}>{data.user.name}</div>
              <div className="ssctl-muted" style={{ fontSize: 12 }}>{data.user.email}</div>
              <div style={{ marginTop: 6, fontSize: 20, fontWeight: 700 }}><Coins size={16} color="var(--ss-accent)" /> {Number(data.user.balance).toLocaleString()} Photons</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input className="ssctl-input" style={{ width: 120 }} type="number" min="1" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <button className="ssctl-btn" style={{ minHeight: 40 }} disabled={!(parseInt(amount, 10) > 0)} onClick={() => setModal({ sign: 1 })}><Plus size={14} /> Grant</button>
              <button className="ssctl-btn ssctl-btn-danger" style={{ minHeight: 40 }} disabled={!(parseInt(amount, 10) > 0)} onClick={() => setModal({ sign: -1 })}><Minus size={14} /> Deduct</button>
            </div>
          </div>
          <div className="ssctl-card" style={{ padding: 0 }}>
            <table className="ssctl-table">
              <thead><tr><th>Δ</th><th>Source</th><th>When</th></tr></thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row._id}>
                    <td style={{ color: row.delta >= 0 ? 'var(--ss-ok, #22c55e)' : 'var(--ss-danger, #ff4b4b)', fontWeight: 600 }}>{row.delta >= 0 ? '+' : ''}{row.delta}</td>
                    <td className="ssctl-muted">{row.source}</td>
                    <td className="ssctl-muted">{new Date(row.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
                {data.rows.length === 0 && <tr><td colSpan={3} className="ssctl-muted" style={{ textAlign: 'center', padding: 20 }}>No ledger entries.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
      <ConfirmModal
        open={!!modal}
        danger={modal?.sign < 0}
        title={`${modal?.sign < 0 ? 'Deduct' : 'Grant'} ${Number(amount || 0).toLocaleString()} Photons`}
        message={`This ${modal?.sign < 0 ? 'removes' : 'adds'} Photons for ${data?.user?.name}. It affects the currency balance only — never rank. This is audited.`}
        confirmLabel={modal?.sign < 0 ? 'Deduct' : 'Grant'}
        requireReason
        busy={busy}
        onConfirm={doAdjust}
        onClose={() => setModal(null)}
      />
    </div>
  );
}

function EarnRules({ toast }) {
  const [rows, setRows] = useState(null);
  const [edits, setEdits] = useState({});
  const load = useCallback(() => {
    adminApi.get('/economy/config').then((r) => { setRows(r.data.rows); setEdits({}); }).catch(() => setRows([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (key, value) => {
    try {
      await adminApi.patch('/economy/config', { key, value });
      toast.push(value === null ? `${key} reset to default` : `${key} updated`, 'success');
      load();
    } catch (e) {
      toast.push(e.response?.data?.message || 'Update failed', 'error');
    }
  };

  if (!rows) return <div className="ssctl-muted">Loading…</div>;
  return (
    <div className="ssctl-card" style={{ padding: 0 }}>
      <table className="ssctl-table">
        <thead><tr><th>Key</th><th>Default</th><th>Current</th><th>New value</th><th /></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}>
              <td>{r.key}</td>
              <td className="ssctl-muted">{String(r.default)}</td>
              <td>{String(r.value)}{r.overridden && <span className="ssctl-badge-role" style={{ marginLeft: 6 }}>overridden</span>}</td>
              <td>
                <input className="ssctl-input" style={{ width: 110 }} type="number" min="0"
                  value={edits[r.key] ?? ''} placeholder={String(r.value)}
                  onChange={(e) => setEdits((s) => ({ ...s, [r.key]: e.target.value }))} />
              </td>
              <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                <button className="ssctl-btn" style={{ minHeight: 28, fontSize: 12, padding: '4px 8px', marginRight: 4 }}
                  disabled={edits[r.key] === undefined || edits[r.key] === ''}
                  onClick={() => save(r.key, Number(edits[r.key]))}>Save</button>
                {r.overridden && (
                  <button className="ssctl-btn ssctl-btn-ghost" style={{ minHeight: 28, fontSize: 12, padding: '4px 8px' }} title="Reset to default"
                    onClick={() => save(r.key, null)}><RotateCcw size={12} /></button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Economy() {
  const [tab, setTab] = useState('supply');
  const toast = useToast();
  return (
    <div>
      <h1 className="ssctl-h1">Economy &amp; Photons</h1>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[['supply', 'Supply'], ['ledger', 'Ledger & Grants'], ['rules', 'Earn Rules']].map(([id, label]) => (
          <button key={id} className={`ssctl-btn ${tab === id ? '' : 'ssctl-btn-ghost'}`} style={{ minHeight: 36, fontSize: 13 }} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {tab === 'supply' && <Supply />}
      {tab === 'ledger' && <Ledger toast={toast} />}
      {tab === 'rules' && <EarnRules toast={toast} />}
      {toast.Toasts}
    </div>
  );
}
