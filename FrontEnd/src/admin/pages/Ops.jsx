/**
 * Ops — Calls monitoring + Skill taxonomy + Review moderation (spec H + I).
 *   • Calls    — recent/active call sessions (read-only observability).
 *   • Skills   — CRUD the admin-managed skill-category taxonomy (net-new).
 *   • Reviews  — hide/restore abusive reviews (soft + reversible, audited).
 */
import { useCallback, useEffect, useState } from 'react';
import { Plus, EyeOff, Eye } from 'lucide-react';
import adminApi from '../adminApi';
import useToast from '../components/Toast';
import ConfirmModal from '../components/ConfirmModal';

function Calls() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('');
  useEffect(() => {
    adminApi.get(`/ops/calls${status ? `?status=${status}` : ''}`).then((r) => setData(r.data)).catch(() => setData({ rows: [] }));
  }, [status]);
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <select className="ssctl-input" style={{ maxWidth: 160 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {['ringing', 'accepted', 'ended', 'missed', 'declined'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {data && <span className="ssctl-muted" style={{ fontSize: 13 }}>Active now: <strong>{data.active ?? 0}</strong></span>}
      </div>
      <div className="ssctl-card" style={{ padding: 0 }}>
        <table className="ssctl-table">
          <thead><tr><th>Caller</th><th>Receiver</th><th>Status</th><th>Duration</th><th>When</th></tr></thead>
          <tbody>
            {data?.rows.map((c) => (
              <tr key={c._id}>
                <td>{c.caller?.name || '—'}</td>
                <td>{c.receiver?.name || '—'}</td>
                <td><span className={`ssctl-badge-${c.status === 'ended' || c.status === 'accepted' ? 'active' : c.status === 'missed' || c.status === 'declined' ? 'banned' : 'role'}`}>{c.status}</span></td>
                <td className="ssctl-muted">{c.duration ? `${Math.round(c.duration / 60)}m` : '—'}</td>
                <td className="ssctl-muted">{c.createdAt ? new Date(c.createdAt).toLocaleString() : ''}</td>
              </tr>
            ))}
            {data && data.rows.length === 0 && <tr><td colSpan={5} className="ssctl-muted" style={{ textAlign: 'center', padding: 24 }}>No call sessions.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Categories({ toast }) {
  const [rows, setRows] = useState(null);
  const [form, setForm] = useState(null); // { slug, label, aliases }
  const load = useCallback(() => { adminApi.get('/ops/categories').then((r) => setRows(r.data.rows)).catch(() => setRows([])); }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    try { await adminApi.post('/ops/categories', form); toast.push('Category created', 'success'); setForm(null); load(); }
    catch (e) { toast.push(e.response?.data?.message || 'Failed', 'error'); }
  };
  const toggle = async (slug, active) => {
    try { await adminApi.patch(`/ops/categories/${slug}`, { active }); load(); }
    catch (e) { toast.push(e.response?.data?.message || 'Failed', 'error'); }
  };

  return (
    <div>
      <div style={{ marginBottom: 12, textAlign: 'right' }}>
        <button className="ssctl-btn" style={{ minHeight: 40 }} onClick={() => setForm({ slug: '', label: '', aliases: '' })}><Plus size={14} /> New category</button>
      </div>
      {form && (
        <div className="ssctl-card" style={{ marginBottom: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8, alignItems: 'end' }}>
          <label className="ssctl-label">Slug<input className="ssctl-input" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} placeholder="web-development" /></label>
          <label className="ssctl-label">Label<input className="ssctl-input" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="Web Development" /></label>
          <label className="ssctl-label">Aliases (comma)<input className="ssctl-input" value={form.aliases} onChange={(e) => setForm((f) => ({ ...f, aliases: e.target.value }))} placeholder="react, frontend" /></label>
          <div><button className="ssctl-btn" style={{ minHeight: 40 }} onClick={create}>Save</button> <button className="ssctl-btn ssctl-btn-ghost" style={{ minHeight: 40 }} onClick={() => setForm(null)}>Cancel</button></div>
        </div>
      )}
      <div className="ssctl-card" style={{ padding: 0 }}>
        <table className="ssctl-table">
          <thead><tr><th>Slug</th><th>Label</th><th>Aliases</th><th>Active</th><th /></tr></thead>
          <tbody>
            {rows?.map((c) => (
              <tr key={c.slug}>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{c.slug}</td>
                <td>{c.label}</td>
                <td className="ssctl-muted">{(c.aliases || []).join(', ')}</td>
                <td><span className={`ssctl-badge-${c.active ? 'active' : 'banned'}`}>{c.active ? 'active' : 'archived'}</span></td>
                <td style={{ textAlign: 'right' }}><button className="ssctl-btn ssctl-btn-ghost" style={{ minHeight: 26, fontSize: 12, padding: '3px 8px' }} onClick={() => toggle(c.slug, !c.active)}>{c.active ? 'Archive' : 'Restore'}</button></td>
              </tr>
            ))}
            {rows && rows.length === 0 && <tr><td colSpan={5} className="ssctl-muted" style={{ textAlign: 'center', padding: 24 }}>No categories yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Reviews({ toast }) {
  const [rows, setRows] = useState(null);
  const [filter, setFilter] = useState('false'); // visible by default
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { adminApi.get(`/ops/reviews?hidden=${filter}`).then((r) => setRows(r.data.rows)).catch(() => setRows([])); }, [filter]);
  useEffect(() => { load(); }, [load]);

  const hide = async (reason) => {
    setBusy(true);
    try { await adminApi.post(`/ops/reviews/${modal._id}/hide`, { reason }); toast.push('Review hidden', 'success'); setModal(null); load(); }
    catch (e) { toast.push(e.response?.data?.message || 'Failed', 'error'); }
    finally { setBusy(false); }
  };
  const restore = async (id) => {
    try { await adminApi.post(`/ops/reviews/${id}/restore`); toast.push('Review restored', 'success'); load(); }
    catch (e) { toast.push(e.response?.data?.message || 'Failed', 'error'); }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {[['false', 'Visible'], ['true', 'Hidden']].map(([v, l]) => (
          <button key={v} className={`ssctl-btn ${filter === v ? '' : 'ssctl-btn-ghost'}`} style={{ minHeight: 34, fontSize: 13 }} onClick={() => setFilter(v)}>{l}</button>
        ))}
      </div>
      <div className="ssctl-card" style={{ padding: 0 }}>
        <table className="ssctl-table">
          <thead><tr><th>From</th><th>To</th><th>★</th><th>Review</th><th /></tr></thead>
          <tbody>
            {rows?.map((r) => (
              <tr key={r._id}>
                <td className="ssctl-muted">{r.fromUser?.name || '—'}</td>
                <td>{r.toUser?.name || '—'}</td>
                <td>{r.score}</td>
                <td style={{ maxWidth: 320 }}>{r.review}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {r.hidden
                    ? <button className="ssctl-btn ssctl-btn-ghost" style={{ minHeight: 26, fontSize: 12, padding: '3px 8px' }} onClick={() => restore(r._id)}><Eye size={12} /> Restore</button>
                    : <button className="ssctl-btn ssctl-btn-danger" style={{ minHeight: 26, fontSize: 12, padding: '3px 8px' }} onClick={() => setModal(r)}><EyeOff size={12} /> Hide</button>}
                </td>
              </tr>
            ))}
            {rows && rows.length === 0 && <tr><td colSpan={5} className="ssctl-muted" style={{ textAlign: 'center', padding: 24 }}>No {filter === 'true' ? 'hidden' : 'visible'} reviews.</td></tr>}
          </tbody>
        </table>
      </div>
      <ConfirmModal open={!!modal} danger title="Hide this review" message={`"${modal?.review || ''}" — withheld from public listings. Reversible. Audited.`} confirmLabel="Hide" requireReason busy={busy} onConfirm={hide} onClose={() => setModal(null)} />
    </div>
  );
}

export default function Ops() {
  const [tab, setTab] = useState('calls');
  const toast = useToast();
  return (
    <div>
      <h1 className="ssctl-h1">Ops &amp; Moderation</h1>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[['calls', 'Calls'], ['skills', 'Skill Categories'], ['reviews', 'Reviews']].map(([id, label]) => (
          <button key={id} className={`ssctl-btn ${tab === id ? '' : 'ssctl-btn-ghost'}`} style={{ minHeight: 36, fontSize: 13 }} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {tab === 'calls' && <Calls />}
      {tab === 'skills' && <Categories toast={toast} />}
      {tab === 'reviews' && <Reviews toast={toast} />}
      {toast.Toasts}
    </div>
  );
}
