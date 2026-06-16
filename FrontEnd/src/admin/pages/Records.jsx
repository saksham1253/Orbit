/**
 * Records — raw collection browser + the safe user-deletion pipeline.
 * Deletion shows a cascade preview, defaults to recoverable soft-delete, and
 * gates the irreversible GDPR hard-delete behind a typed-email confirmation +
 * reason. Every action is audited server-side.
 */
import { useCallback, useEffect, useState } from 'react';
import { Search, AlertTriangle, Trash2, RotateCcw, X, Loader2, ShieldX } from 'lucide-react';
import adminApi from '../adminApi';

const COLLECTIONS = ['users', 'ratings', 'connections', 'messages', 'calls', 'skills', 'reports', 'rankEvents', 'legends'];

function DeletionModal({ user, onClose, onChanged }) {
  const [preview, setPreview] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [reason, setReason] = useState('');

  const load = useCallback(() => {
    adminApi.get(`/records/users/${user._id}/delete-preview`).then((r) => setPreview(r.data)).catch((e) => setErr(e?.response?.data?.message || 'Failed'));
  }, [user._id]);
  useEffect(() => { load(); }, [load]);

  const run = async (label, fn) => {
    setBusy(label); setErr('');
    try { await fn(); onChanged(); onClose(); }
    catch (e) { setErr(e?.response?.data?.message || 'Action failed'); setBusy(''); }
  };

  const c = preview?.cascade;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.6)' }} onClick={onClose} />
      <div className="ssctl-card" style={{ position: 'relative', width: 520, maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <button className="ssctl-btn ssctl-btn-ghost" style={{ position: 'absolute', top: 12, right: 12, minHeight: 30, padding: 6 }} onClick={onClose}><X size={15} /></button>
        <h2 className="ssctl-h1" style={{ marginBottom: 4 }}>Delete data</h2>
        <p className="ssctl-muted" style={{ marginTop: 0, fontSize: 13 }}>{user.name} · {user.email}</p>

        {!preview ? <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}><div className="ssctl-spin" /></div> : (
          <>
            <p className="ssctl-section-title" style={{ marginTop: 14 }}>Cascade preview</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 13 }}>
              {Object.entries(c).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--ss-panel-2)', borderRadius: 8, padding: '6px 10px' }}>
                  <span className="ssctl-muted">{k}</span><strong>{v}</strong>
                </div>
              ))}
            </div>

            {err && <p className="ssctl-err">{err}</p>}

            {/* Soft delete (default, recoverable) */}
            <div style={{ marginTop: 18, padding: 14, border: '1px solid var(--ss-border)', borderRadius: 10 }}>
              <strong style={{ fontSize: 14 }}>Soft delete (recommended)</strong>
              <p className="ssctl-muted" style={{ fontSize: 12, margin: '4px 0 10px' }}>Hides + blocks login. Fully recoverable.</p>
              <input className="ssctl-input" placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} style={{ marginBottom: 8 }} />
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="ssctl-btn" style={{ flex: 1, minHeight: 38, fontSize: 13 }} disabled={!!busy}
                  onClick={() => run('soft', () => adminApi.post(`/records/users/${user._id}/soft-delete`, { reason }))}>
                  {busy === 'soft' ? <Loader2 size={13} /> : <Trash2 size={13} />} Soft delete
                </button>
                <button className="ssctl-btn ssctl-btn-ghost" style={{ flex: 1, minHeight: 38, fontSize: 13 }} disabled={!!busy}
                  onClick={() => run('restore', () => adminApi.post(`/records/users/${user._id}/restore`))}>
                  <RotateCcw size={13} /> Restore
                </button>
              </div>
            </div>

            {/* Hard delete — irreversible, gated */}
            <div style={{ marginTop: 14, padding: 14, border: '1px solid var(--ss-danger)', borderRadius: 10, background: 'rgba(255,84,112,.06)' }}>
              <strong style={{ fontSize: 14, color: 'var(--ss-danger)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertTriangle size={15} /> Hard delete — GDPR full erasure
              </strong>
              <p className="ssctl-muted" style={{ fontSize: 12, margin: '4px 0 10px' }}>
                Permanently removes the user and ALL related records above. This cannot be undone. A before-snapshot is written to the audit log.
              </p>
              <label className="ssctl-label">Type the user's email to confirm</label>
              <input className="ssctl-input" placeholder={user.email} value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} style={{ marginBottom: 8 }} />
              <label className="ssctl-label">Reason (required)</label>
              <input className="ssctl-input" value={reason} onChange={(e) => setReason(e.target.value)} style={{ marginBottom: 10 }} />
              <button className="ssctl-btn ssctl-btn-danger" style={{ width: '100%', minHeight: 40 }}
                disabled={!!busy || confirmEmail.toLowerCase().trim() !== user.email.toLowerCase() || !reason.trim()}
                onClick={() => run('hard', () => adminApi.post(`/records/users/${user._id}/hard-delete`, { confirmEmail, reason }))}>
                {busy === 'hard' ? <Loader2 size={14} /> : <ShieldX size={14} />} Permanently erase everything
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function Records() {
  const [coll, setColl] = useState('users');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [delUser, setDelUser] = useState(null);

  const load = useCallback(() => {
    const p = new URLSearchParams({ page: String(page) });
    if (q) p.set('q', q);
    setData(null);
    adminApi.get(`/records/${coll}?${p}`).then((r) => setData(r.data)).catch(() => setData({ rows: [], pages: 1 }));
  }, [coll, q, page]);
  // load() resets to the loading spinner before fetching; intentional.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <h1 className="ssctl-h1">Records {data ? <span className="ssctl-muted" style={{ fontSize: 14 }}>· {data.total} in {coll}</span> : ''}</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <select className="ssctl-input" style={{ width: 160 }} value={coll} onChange={(e) => { setPage(1); setQ(''); setColl(e.target.value); }}>
          {COLLECTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={15} style={{ position: 'absolute', left: 11, top: 12, color: 'var(--ss-text-dim)' }} />
          <input className="ssctl-input" style={{ paddingLeft: 34 }} placeholder="Search by id or text…" value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} />
        </div>
      </div>

      <div className="ssctl-card" style={{ padding: 0, overflow: 'auto' }}>
        {!data ? <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="ssctl-spin" /></div> : coll === 'users' ? (
          <table className="ssctl-table">
            <thead><tr><th>Name</th><th>Email</th><th>Status</th><th /></tr></thead>
            <tbody>
              {data.rows.map((u) => (
                <tr key={u._id}>
                  <td>{u.name}</td><td className="ssctl-muted">{u.email}</td>
                  <td><span className={`ssctl-badge ssctl-badge-${u.status}`}>{u.status}</span></td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="ssctl-btn ssctl-btn-ghost" style={{ minHeight: 30, fontSize: 12, padding: '5px 10px' }} onClick={() => setDelUser(u)}>
                      <Trash2 size={12} /> Manage deletion
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: 14 }}>
            {data.rows.map((r) => (
              <pre key={r._id} style={{ background: 'var(--ss-panel-2)', border: '1px solid var(--ss-border)', borderRadius: 8, padding: 10, fontSize: 11.5, overflowX: 'auto', margin: '0 0 8px' }}>
                {JSON.stringify(r, null, 2)}
              </pre>
            ))}
            {data.rows.length === 0 && <div className="ssctl-muted" style={{ textAlign: 'center', padding: 20 }}>No records.</div>}
          </div>
        )}
      </div>

      {data && data.pages > 1 && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14, alignItems: 'center' }}>
          <button className="ssctl-btn ssctl-btn-ghost" disabled={page <= 1} style={{ minHeight: 34 }} onClick={() => setPage((p) => p - 1)}>Prev</button>
          <span className="ssctl-muted" style={{ fontSize: 13 }}>{page} / {data.pages}</span>
          <button className="ssctl-btn ssctl-btn-ghost" disabled={page >= data.pages} style={{ minHeight: 34 }} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}

      {delUser && <DeletionModal user={delUser} onClose={() => setDelUser(null)} onChanged={load} />}
    </div>
  );
}
