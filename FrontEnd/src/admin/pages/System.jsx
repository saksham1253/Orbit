/**
 * System — seasons overview, storage/archive health (migrated from the legacy
 * admin tooling, now RBAC-gated), a non-mutating recompute dry-run, and CSV
 * exports. Mutating actions (run archive) are audited.
 */
import { useEffect, useState } from 'react';
import { Download, HardDrive, Play, Loader2, RefreshCw } from 'lucide-react';
import adminApi from '../adminApi';

export default function System() {
  const [seasons, setSeasons] = useState(null);
  const [storage, setStorage] = useState(null);
  const [archive, setArchive] = useState(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  const loadAll = () => {
    adminApi.get('/seasons').then((r) => setSeasons(r.data.seasons)).catch(() => setSeasons([]));
    adminApi.get('/system/storage-stats').then((r) => setStorage(r.data)).catch(() => setStorage(null));
    adminApi.get('/system/archive-status').then((r) => setArchive(r.data)).catch(() => setArchive(null));
  };
  useEffect(() => { loadAll(); }, []);

  const exportCsv = async (path, filename) => {
    setBusy(filename);
    try {
      const r = await adminApi.get(path, { responseType: 'blob' });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } catch { setMsg('Export failed.'); } finally { setBusy(''); }
  };

  const dryRun = async () => {
    setBusy('dry'); setMsg('');
    try { const r = await adminApi.post('/system/recompute-dry-run'); setMsg(`Dry run: ${r.data.wouldRecompute} mentors would be recomputed (nothing changed).`); }
    catch { setMsg('Dry run failed.'); } finally { setBusy(''); }
  };

  const runArchive = async () => {
    setBusy('archive'); setMsg('');
    try { const r = await adminApi.post('/system/run-archive'); setMsg(r.data.message); setTimeout(loadAll, 1500); }
    catch { setMsg('Archive trigger failed.'); } finally { setBusy(''); }
  };

  return (
    <div>
      <h1 className="ssctl-h1">System</h1>
      {msg && <div className="ssctl-card" style={{ marginBottom: 14, fontSize: 13 }}>{msg}</div>}

      <div className="ssctl-grid" style={{ gridTemplateColumns: '1fr 1fr', alignItems: 'start' }}>
        <div className="ssctl-card">
          <p className="ssctl-section-title">Seasons</p>
          {!seasons ? <div className="ssctl-spin" /> : (
            <table className="ssctl-table">
              <thead><tr><th>Season</th><th>Status</th><th>Starts</th></tr></thead>
              <tbody>
                {seasons.map((s) => (
                  <tr key={s._id}><td>{s.seasonId}</td><td><span className={`ssctl-badge ${s.status === 'active' ? 'ssctl-badge-active' : 'ssctl-badge-soft_deleted'}`}>{s.status}</span></td><td className="ssctl-muted">{s.startsAt ? new Date(s.startsAt).toLocaleDateString() : '—'}</td></tr>
                ))}
                {seasons.length === 0 && <tr><td colSpan={3} className="ssctl-muted" style={{ textAlign: 'center', padding: 16 }}>No seasons yet.</td></tr>}
              </tbody>
            </table>
          )}
          <button className="ssctl-btn ssctl-btn-ghost" style={{ marginTop: 12, minHeight: 36, fontSize: 13 }} disabled={!!busy} onClick={dryRun}>
            {busy === 'dry' ? <Loader2 size={13} /> : <RefreshCw size={13} />} Recompute dry-run
          </button>
        </div>

        <div className="ssctl-card">
          <p className="ssctl-section-title"><HardDrive size={13} style={{ verticalAlign: -2 }} /> Storage & archive</p>
          {archive ? (
            <div style={{ fontSize: 13, lineHeight: 1.8 }}>
              <div>Hot messages: <strong>{archive.hot.messages}</strong> · calls: <strong>{archive.hot.callHistories}</strong></div>
              <div className="ssctl-muted">Archived: {archive.archived.archivedMessages} msgs in {archive.archived.chatArchiveBuckets} buckets · {archive.archived.callArchives} calls</div>
            </div>
          ) : <div className="ssctl-muted" style={{ fontSize: 13 }}>No archive data.</div>}
          {storage?.totalMB != null && <p className="ssctl-muted" style={{ fontSize: 12 }}>Snapshot: {storage.totalMB} MB</p>}
          <button className="ssctl-btn ssctl-btn-ghost" style={{ marginTop: 10, minHeight: 36, fontSize: 13 }} disabled={!!busy} onClick={runArchive}>
            {busy === 'archive' ? <Loader2 size={13} /> : <Play size={13} />} Run archive job
          </button>
        </div>
      </div>

      <div className="ssctl-card" style={{ marginTop: 18 }}>
        <p className="ssctl-section-title">Exports</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="ssctl-btn ssctl-btn-ghost" style={{ minHeight: 38, fontSize: 13 }} disabled={!!busy} onClick={() => exportCsv('/export/users.csv', 'users.csv')}>
            {busy === 'users.csv' ? <Loader2 size={13} /> : <Download size={13} />} Users CSV
          </button>
          <button className="ssctl-btn ssctl-btn-ghost" style={{ minHeight: 38, fontSize: 13 }} disabled={!!busy} onClick={() => exportCsv('/export/rank-events.csv', 'rank-events.csv')}>
            {busy === 'rank-events.csv' ? <Loader2 size={13} /> : <Download size={13} />} Rank events CSV
          </button>
        </div>
      </div>
    </div>
  );
}
