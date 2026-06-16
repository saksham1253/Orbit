/**
 * Moderation — the reports queue (resolve/dismiss with notes) and the read-only
 * anti-gaming flags list. All resolutions are audited. Flags never auto-ban.
 */
import { useCallback, useEffect, useState } from 'react';
import { Check, XCircle, Flag } from 'lucide-react';
import adminApi from '../adminApi';

function Reports() {
  const [status, setStatus] = useState('open');
  const [data, setData] = useState(null);
  const load = useCallback(() => {
    adminApi.get(`/reports?status=${status}`).then((r) => setData(r.data)).catch(() => setData({ rows: [] }));
  }, [status]);
  useEffect(() => { load(); }, [load]);

  const resolve = async (id, s) => {
    const notes = s === 'resolved' ? (prompt('Resolution notes (optional):') || '') : '';
    await adminApi.post(`/reports/${id}/resolve`, { status: s, notes });
    load();
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {['open', 'resolved', 'dismissed'].map((s) => (
          <button key={s} className={`ssctl-btn ${status === s ? '' : 'ssctl-btn-ghost'}`} style={{ minHeight: 34, fontSize: 13 }} onClick={() => setStatus(s)}>{s}</button>
        ))}
      </div>
      <div className="ssctl-card" style={{ padding: 0 }}>
        <table className="ssctl-table">
          <thead><tr><th>Target</th><th>Reporter</th><th>Reason</th><th>When</th><th /></tr></thead>
          <tbody>
            {data?.rows.map((r) => (
              <tr key={r._id}>
                <td>{r.targetUserId?.name || '—'}</td>
                <td className="ssctl-muted">{r.reporterId?.name || '—'}</td>
                <td>{r.reason}</td>
                <td className="ssctl-muted">{new Date(r.createdAt).toLocaleDateString()}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {r.status === 'open' ? (
                    <>
                      <button className="ssctl-btn ssctl-btn-ghost" style={{ minHeight: 28, fontSize: 12, padding: '4px 8px', marginRight: 4 }} onClick={() => resolve(r._id, 'resolved')}><Check size={12} /> Resolve</button>
                      <button className="ssctl-btn ssctl-btn-ghost" style={{ minHeight: 28, fontSize: 12, padding: '4px 8px' }} onClick={() => resolve(r._id, 'dismissed')}><XCircle size={12} /> Dismiss</button>
                    </>
                  ) : <span className="ssctl-muted" style={{ fontSize: 12 }}>{r.status}</span>}
                </td>
              </tr>
            ))}
            {data && data.rows.length === 0 && <tr><td colSpan={5} className="ssctl-muted" style={{ textAlign: 'center', padding: 24 }}>No {status} reports.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Flags() {
  const [data, setData] = useState(null);
  useEffect(() => { adminApi.get('/flags').then((r) => setData(r.data)).catch(() => setData({ rows: [] })); }, []);
  return (
    <div className="ssctl-card" style={{ padding: 0 }}>
      <table className="ssctl-table">
        <thead><tr><th>User</th><th>Reason</th><th>Reports</th><th>Trust</th></tr></thead>
        <tbody>
          {data?.rows.map((u) => (
            <tr key={u._id}>
              <td><Flag size={12} color="var(--ss-warn)" /> {u.name}</td>
              <td className="ssctl-muted">{u.flagReason}</td>
              <td>{u.reportCount}</td>
              <td>{u.trustScore}</td>
            </tr>
          ))}
          {data && data.rows.length === 0 && <tr><td colSpan={4} className="ssctl-muted" style={{ textAlign: 'center', padding: 24 }}>No flagged users.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export default function Moderation() {
  const [tab, setTab] = useState('reports');
  return (
    <div>
      <h1 className="ssctl-h1">Moderation</h1>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        <button className={`ssctl-btn ${tab === 'reports' ? '' : 'ssctl-btn-ghost'}`} style={{ minHeight: 36, fontSize: 13 }} onClick={() => setTab('reports')}>Reports</button>
        <button className={`ssctl-btn ${tab === 'flags' ? '' : 'ssctl-btn-ghost'}`} style={{ minHeight: 36, fontSize: 13 }} onClick={() => setTab('flags')}>Flags</button>
      </div>
      {tab === 'reports' ? <Reports /> : <Flags />}
    </div>
  );
}
