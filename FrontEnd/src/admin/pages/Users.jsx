/**
 * Users — searchable/paginated user table + a detail drawer with audited actions
 * (edit fields, change role, suspend/ban/activate, trigger password reset).
 */
import { useCallback, useEffect, useState } from 'react';
import { Search, X, Shield, Ban, UserCheck, KeyRound, Loader2 } from 'lucide-react';
import adminApi from '../adminApi';

const STATUS = ['', 'active', 'suspended', 'banned', 'soft_deleted'];
const ROLES = ['', 'user', 'moderator', 'admin'];

function Drawer({ id, onClose, onChanged }) {
  const [d, setD] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(() => {
    setD(null);
    adminApi.get(`/users/${id}`).then((r) => setD(r.data)).catch((e) => setErr(e?.response?.data?.message || 'Failed'));
  }, [id]);
  // load() resets to the loading spinner then fetches; intentional.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const act = async (label, fn) => {
    setBusy(label); setErr('');
    try { await fn(); load(); onChanged(); }
    catch (e) { setErr(e?.response?.data?.message || 'Action failed'); }
    finally { setBusy(''); }
  };

  const u = d?.user;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.5)' }} onClick={onClose} />
      <div className="ssctl-card" style={{ position: 'relative', width: 460, maxWidth: '100%', height: '100%', borderRadius: 0, overflowY: 'auto' }}>
        <button className="ssctl-btn ssctl-btn-ghost" style={{ position: 'absolute', top: 14, right: 14, minHeight: 32, padding: 6 }} onClick={onClose}><X size={16} /></button>
        {!d ? <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="ssctl-spin" /></div> : (
          <>
            <h2 className="ssctl-h1" style={{ marginTop: 4 }}>{u.name}</h2>
            <p className="ssctl-muted" style={{ marginTop: -8, fontSize: 13 }}>{u.email}</p>
            <div style={{ display: 'flex', gap: 6, margin: '8px 0 16px' }}>
              <span className={`ssctl-badge ssctl-badge-${u.status}`}>{u.status}</span>
              <span className="ssctl-badge ssctl-badge-role">{u.role}</span>
            </div>

            <div className="ssctl-grid" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 16 }}>
              {[['Ratings received', d.stats.ratingsReceived], ['Ratings given', d.stats.ratingsGiven], ['Completed swaps', d.stats.completedSwaps], ['Calls', d.stats.calls]].map(([l, v]) => (
                <div key={l} className="ssctl-kpi" style={{ padding: 12 }}><div className="v" style={{ fontSize: 18 }}>{v}</div><div className="l">{l}</div></div>
              ))}
            </div>

            <p className="ssctl-section-title">Cosmic</p>
            <p style={{ fontSize: 13, marginTop: 0 }}>Score {Math.round((u.cosmic?.score || 0) * 10) / 10} · Tier {u.cosmic?.tierId} · Peak {u.cosmic?.peakTierId}</p>

            <p className="ssctl-section-title">Security</p>
            <p style={{ fontSize: 13, marginTop: 0 }} className="ssctl-muted">
              Logins {d.security.loginCount ?? 0} · Trust {u.trustScore}
              {u.isFlagged ? ` · FLAGGED: ${u.flagReason}` : ''}
            </p>

            {err && <p className="ssctl-err">{err}</p>}

            <p className="ssctl-section-title" style={{ marginTop: 18 }}>Role</p>
            <div style={{ display: 'flex', gap: 6 }}>
              {['user', 'moderator', 'admin'].map((r) => (
                <button key={r} disabled={busy || u.role === r}
                  className={`ssctl-btn ${u.role === r ? '' : 'ssctl-btn-ghost'}`} style={{ flex: 1, minHeight: 38, fontSize: 13 }}
                  onClick={() => act('role', () => adminApi.post(`/users/${id}/role`, { role: r }))}>
                  <Shield size={13} /> {r}
                </button>
              ))}
            </div>

            <p className="ssctl-section-title" style={{ marginTop: 18 }}>Status</p>
            <div style={{ display: 'flex', gap: 6 }}>
              <button disabled={!!busy} className="ssctl-btn ssctl-btn-ghost" style={{ flex: 1, minHeight: 38, fontSize: 13 }}
                onClick={() => act('active', () => adminApi.post(`/users/${id}/status`, { status: 'active' }))}>
                <UserCheck size={13} /> Activate
              </button>
              <button disabled={!!busy} className="ssctl-btn ssctl-btn-ghost" style={{ flex: 1, minHeight: 38, fontSize: 13 }}
                onClick={() => act('suspend', () => adminApi.post(`/users/${id}/status`, { status: 'suspended', days: 7, reason: 'admin suspend' }))}>
                Suspend 7d
              </button>
              <button disabled={!!busy} className="ssctl-btn ssctl-btn-danger" style={{ flex: 1, minHeight: 38, fontSize: 13 }}
                onClick={() => act('ban', () => adminApi.post(`/users/${id}/status`, { status: 'banned', reason: 'admin ban' }))}>
                <Ban size={13} /> Ban
              </button>
            </div>

            <p className="ssctl-section-title" style={{ marginTop: 18 }}>Account</p>
            <button disabled={!!busy} className="ssctl-btn ssctl-btn-ghost" style={{ width: '100%', minHeight: 38, fontSize: 13 }}
              onClick={() => act('reset', () => adminApi.post(`/users/${id}/reset-password`))}>
              {busy === 'reset' ? <Loader2 size={14} /> : <KeyRound size={14} />} Send password-reset email
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function Users() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [openId, setOpenId] = useState(null);

  const load = useCallback(() => {
    const params = new URLSearchParams({ page: String(page) });
    if (q) params.set('q', q);
    if (status) params.set('status', status);
    if (role) params.set('role', role);
    adminApi.get(`/users?${params}`).then((r) => setData(r.data)).catch(() => setData({ rows: [], total: 0, pages: 1 }));
  }, [q, status, role, page]);
  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <h1 className="ssctl-h1">Users {data ? <span className="ssctl-muted" style={{ fontSize: 14 }}>· {data.total}</span> : ''}</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={15} style={{ position: 'absolute', left: 11, top: 12, color: 'var(--ss-text-dim)' }} />
          <input className="ssctl-input" style={{ paddingLeft: 34 }} placeholder="Search name, email, city…"
            value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} />
        </div>
        <select className="ssctl-input" style={{ width: 150 }} value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
          {STATUS.map((s) => <option key={s} value={s}>{s || 'All statuses'}</option>)}
        </select>
        <select className="ssctl-input" style={{ width: 140 }} value={role} onChange={(e) => { setPage(1); setRole(e.target.value); }}>
          {ROLES.map((r) => <option key={r} value={r}>{r || 'All roles'}</option>)}
        </select>
      </div>

      <div className="ssctl-card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="ssctl-table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Tier</th><th>Joined</th></tr></thead>
          <tbody>
            {data?.rows.map((u) => (
              <tr key={u._id} style={{ cursor: 'pointer' }} onClick={() => setOpenId(u._id)}>
                <td>{u.name}</td>
                <td className="ssctl-muted">{u.email}</td>
                <td><span className="ssctl-badge ssctl-badge-role">{u.role}</span></td>
                <td><span className={`ssctl-badge ssctl-badge-${u.status}`}>{u.status}</span></td>
                <td className="ssctl-muted">{u.cosmic?.tierId}</td>
                <td className="ssctl-muted">{new Date(u.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {data && data.rows.length === 0 && <tr><td colSpan={6} className="ssctl-muted" style={{ textAlign: 'center', padding: 24 }}>No users match.</td></tr>}
          </tbody>
        </table>
      </div>

      {data && data.pages > 1 && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14, alignItems: 'center' }}>
          <button className="ssctl-btn ssctl-btn-ghost" disabled={page <= 1} style={{ minHeight: 34 }} onClick={() => setPage((p) => p - 1)}>Prev</button>
          <span className="ssctl-muted" style={{ fontSize: 13 }}>Page {page} / {data.pages}</span>
          <button className="ssctl-btn ssctl-btn-ghost" disabled={page >= data.pages} style={{ minHeight: 34 }} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}

      {openId && <Drawer id={openId} onClose={() => setOpenId(null)} onChanged={load} />}
    </div>
  );
}
