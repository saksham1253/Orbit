/**
 * Audit — viewer for the append-only AuditLog. Filter by action/actor, expand a
 * row to see before/after snapshots. There is deliberately no delete control.
 */
import { Fragment, useCallback, useEffect, useState } from 'react';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';
import adminApi from '../adminApi';

export default function Audit() {
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(null);

  const load = useCallback(() => {
    const p = new URLSearchParams({ page: String(page) });
    if (action) p.set('action', action);
    adminApi.get(`/audit?${p}`).then((r) => setData(r.data)).catch(() => setData({ rows: [], pages: 1 }));
  }, [action, page]);
  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <h1 className="ssctl-h1">Audit log {data ? <span className="ssctl-muted" style={{ fontSize: 14 }}>· {data.total}</span> : ''}</h1>
      <p className="ssctl-muted" style={{ fontSize: 12, marginTop: -10, marginBottom: 14 }}>Append-only. Records every admin action; cannot be deleted from the portal.</p>

      <div style={{ position: 'relative', maxWidth: 320, marginBottom: 14 }}>
        <Search size={15} style={{ position: 'absolute', left: 11, top: 12, color: 'var(--ss-text-dim)' }} />
        <input className="ssctl-input" style={{ paddingLeft: 34 }} placeholder="Filter by action (e.g. user.ban)" value={action} onChange={(e) => { setPage(1); setAction(e.target.value); }} />
      </div>

      <div className="ssctl-card" style={{ padding: 0 }}>
        <table className="ssctl-table">
          <thead><tr><th /><th>Action</th><th>Actor</th><th>Target</th><th>OK</th><th>When</th></tr></thead>
          <tbody>
            {data?.rows.map((r) => (
              <Fragment key={r._id}>
                <tr style={{ cursor: 'pointer' }} onClick={() => setOpen(open === r._id ? null : r._id)}>
                  <td>{open === r._id ? <ChevronDown size={13} /> : <ChevronRight size={13} />}</td>
                  <td><code style={{ fontSize: 12 }}>{r.action}</code></td>
                  <td className="ssctl-muted">{r.actorId?.email || r.actorEmail || '—'}</td>
                  <td className="ssctl-muted">{r.targetType}{r.targetId ? `:${String(r.targetId).slice(-6)}` : ''}</td>
                  <td>{r.success ? '✓' : <span style={{ color: 'var(--ss-danger)' }}>✗</span>}</td>
                  <td className="ssctl-muted">{new Date(r.createdAt).toLocaleString()}</td>
                </tr>
                {open === r._id && (
                  <tr>
                    <td colSpan={6} style={{ background: 'var(--ss-panel-2)' }}>
                      <div style={{ fontSize: 12, padding: '4px 0' }}>
                        {r.reason && <div style={{ marginBottom: 6 }}><strong>Reason:</strong> {r.reason}</div>}
                        <div style={{ marginBottom: 4 }}><strong>IP:</strong> <span className="ssctl-muted">{r.ip || '—'}</span></div>
                        {(r.before || r.after) && (
                          <pre style={{ fontSize: 11, overflowX: 'auto', margin: 0 }}>
                            {JSON.stringify({ before: r.before, after: r.after }, null, 2)}
                          </pre>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {data && data.rows.length === 0 && <tr><td colSpan={6} className="ssctl-muted" style={{ textAlign: 'center', padding: 24 }}>No audit entries.</td></tr>}
          </tbody>
        </table>
      </div>

      {data && data.pages > 1 && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14, alignItems: 'center' }}>
          <button className="ssctl-btn ssctl-btn-ghost" disabled={page <= 1} style={{ minHeight: 34 }} onClick={() => setPage((p) => p - 1)}>Prev</button>
          <span className="ssctl-muted" style={{ fontSize: 13 }}>{page} / {data.pages}</span>
          <button className="ssctl-btn ssctl-btn-ghost" disabled={page >= data.pages} style={{ minHeight: 34 }} onClick={() => setPage((p) => p + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}
