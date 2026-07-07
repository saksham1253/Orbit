/**
 * Store — the Nebula Store catalog + rarity module (spec B + C). Two tabs:
 *   • Items  — CRUD over StoreItems: create, edit price/rarity/category, and move
 *              through draft → live → archived (publish/unpublish). Edits hot-
 *              reload the user-facing shop.
 *   • Rarity — edit the 15-tier ladder (label/color/glow/order/live) with the
 *              milestone/league name-collision guardrail enforced server-side.
 *
 * Mutations require the "catalog" portal role; every change is audited.
 */
import { useCallback, useEffect, useState } from 'react';
import { Plus, Archive, Save, X } from 'lucide-react';
import adminApi from '../adminApi';
import useToast from '../components/Toast';

const STATUSES = ['draft', 'live', 'archived'];

function ItemForm({ initial, onSave, onCancel }) {
  const [f, setF] = useState(initial || { key: '', type: 'name_glow', name: '', hint: '', cost: 100, rarity: 'STELLAR', category: 'identity', status: 'draft' });
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const isNew = !initial;
  return (
    <div className="ssctl-card" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <div className="ssctl-section-title">{isNew ? 'New item' : `Edit ${f.key}`}</div>
        <button className="ssctl-btn ssctl-btn-ghost" style={{ minHeight: 28, padding: '4px 8px' }} onClick={onCancel}><X size={14} /></button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
        {isNew && <label className="ssctl-label">Key<input className="ssctl-input" value={f.key} onChange={(e) => set('key', e.target.value)} placeholder="glow_nova" /></label>}
        <label className="ssctl-label">Type<input className="ssctl-input" value={f.type} onChange={(e) => set('type', e.target.value)} /></label>
        <label className="ssctl-label">Name<input className="ssctl-input" value={f.name} onChange={(e) => set('name', e.target.value)} /></label>
        <label className="ssctl-label">Cost<input className="ssctl-input" type="number" min="0" value={f.cost} onChange={(e) => set('cost', Number(e.target.value))} /></label>
        <label className="ssctl-label">Rarity<input className="ssctl-input" value={f.rarity} onChange={(e) => set('rarity', e.target.value.toUpperCase())} /></label>
        <label className="ssctl-label">Category<input className="ssctl-input" value={f.category} onChange={(e) => set('category', e.target.value)} /></label>
        <label className="ssctl-label">Status
          <select className="ssctl-input" value={f.status} onChange={(e) => set('status', e.target.value)}>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>
      <label className="ssctl-label" style={{ marginTop: 8 }}>Hint<input className="ssctl-input" value={f.hint} onChange={(e) => set('hint', e.target.value)} /></label>
      <div style={{ marginTop: 10, textAlign: 'right' }}>
        <button className="ssctl-btn" style={{ minHeight: 36 }} onClick={() => onSave(f, isNew)}><Save size={14} /> Save</button>
      </div>
    </div>
  );
}

function Items({ toast }) {
  const [rows, setRows] = useState(null);
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState(null); // item | 'new' | null

  const load = useCallback(() => {
    adminApi.get(`/store/items${status ? `?status=${status}` : ''}`).then((r) => setRows(r.data.rows)).catch(() => setRows([]));
  }, [status]);
  useEffect(() => { load(); }, [load]);

  const save = async (f, isNew) => {
    try {
      if (isNew) await adminApi.post('/store/items', f);
      else await adminApi.patch(`/store/items/${f.key}`, f);
      toast.push(isNew ? 'Item created' : 'Item saved', 'success');
      setEditing(null); load();
    } catch (e) { toast.push(e.response?.data?.message || 'Save failed', 'error'); }
  };
  const setStatusOf = async (key, s) => {
    try { await adminApi.patch(`/store/items/${key}`, { status: s }); toast.push(`→ ${s}`, 'success'); load(); }
    catch (e) { toast.push(e.response?.data?.message || 'Failed', 'error'); }
  };
  const archive = async (key) => {
    try { await adminApi.post(`/store/items/${key}/archive`); toast.push('Archived', 'success'); load(); }
    catch (e) { toast.push(e.response?.data?.message || 'Failed', 'error'); }
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, alignItems: 'center' }}>
        <select className="ssctl-input" style={{ maxWidth: 160 }} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="ssctl-btn" style={{ minHeight: 40, marginLeft: 'auto' }} onClick={() => setEditing('new')}><Plus size={14} /> New item</button>
      </div>
      {editing === 'new' && <ItemForm onSave={save} onCancel={() => setEditing(null)} />}
      {editing && editing !== 'new' && <ItemForm initial={editing} onSave={save} onCancel={() => setEditing(null)} />}
      <div className="ssctl-card" style={{ padding: 0 }}>
        <table className="ssctl-table">
          <thead><tr><th>Key</th><th>Name</th><th>Type</th><th>Rarity</th><th>Cost</th><th>Status</th><th /></tr></thead>
          <tbody>
            {rows?.map((it) => (
              <tr key={it.key}>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{it.key}</td>
                <td>{it.name}</td>
                <td className="ssctl-muted">{it.type}</td>
                <td>{it.rarity}</td>
                <td>{it.cost}</td>
                <td><span className={`ssctl-badge-${it.status === 'live' ? 'active' : it.status === 'archived' ? 'banned' : 'role'}`}>{it.status}</span></td>
                <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                  <button className="ssctl-btn ssctl-btn-ghost" style={{ minHeight: 26, fontSize: 12, padding: '3px 7px', marginRight: 4 }} onClick={() => setEditing(it)}>Edit</button>
                  {it.status !== 'live'
                    ? <button className="ssctl-btn" style={{ minHeight: 26, fontSize: 12, padding: '3px 7px', marginRight: 4 }} onClick={() => setStatusOf(it.key, 'live')}>Publish</button>
                    : <button className="ssctl-btn ssctl-btn-ghost" style={{ minHeight: 26, fontSize: 12, padding: '3px 7px', marginRight: 4 }} onClick={() => setStatusOf(it.key, 'draft')}>Unpublish</button>}
                  {it.status !== 'archived' && <button className="ssctl-btn ssctl-btn-ghost" style={{ minHeight: 26, fontSize: 12, padding: '3px 7px' }} title="Archive" onClick={() => archive(it.key)}><Archive size={12} /></button>}
                </td>
              </tr>
            ))}
            {rows && rows.length === 0 && <tr><td colSpan={7} className="ssctl-muted" style={{ textAlign: 'center', padding: 24 }}>No items. Seed the store (npm run seed:store) or create one.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Rarity({ toast }) {
  const [rows, setRows] = useState(null);
  const [edits, setEdits] = useState({});
  const load = useCallback(() => { adminApi.get('/store/rarity').then((r) => { setRows(r.data.rows); setEdits({}); }).catch(() => setRows([])); }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (key) => {
    const patch = edits[key] || {};
    try { await adminApi.patch(`/store/rarity/${key}`, patch); toast.push(`${key} updated`, 'success'); load(); }
    catch (e) { toast.push(e.response?.data?.message || 'Failed', 'error'); }
  };
  const edit = (key, field, val) => setEdits((s) => ({ ...s, [key]: { ...(s[key] || {}), [field]: val } }));

  if (!rows) return <div className="ssctl-muted">Loading…</div>;
  return (
    <div className="ssctl-card" style={{ padding: 0 }}>
      <table className="ssctl-table">
        <thead><tr><th>#</th><th>Key</th><th>Label</th><th>Color</th><th>Glow</th><th>Live</th><th /></tr></thead>
        <tbody>
          {rows.map((t) => {
            const e = edits[t.key] || {};
            return (
              <tr key={t.key}>
                <td>{t.order}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{t.key}</td>
                <td><input className="ssctl-input" style={{ width: 120 }} defaultValue={t.label} onChange={(ev) => edit(t.key, 'label', ev.target.value)} /></td>
                <td><input type="color" defaultValue={t.color} onChange={(ev) => edit(t.key, 'color', ev.target.value)} style={{ width: 40, height: 28, border: 'none', background: 'none' }} /></td>
                <td><input className="ssctl-input" style={{ width: 64 }} type="number" defaultValue={t.glow} onChange={(ev) => edit(t.key, 'glow', Number(ev.target.value))} /></td>
                <td><input type="checkbox" defaultChecked={t.live} onChange={(ev) => edit(t.key, 'live', ev.target.checked)} /></td>
                <td style={{ textAlign: 'right' }}><button className="ssctl-btn" style={{ minHeight: 26, fontSize: 12, padding: '3px 9px' }} disabled={!Object.keys(e).length} onClick={() => save(t.key)}>Save</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function Store() {
  const [tab, setTab] = useState('items');
  const toast = useToast();
  return (
    <div>
      <h1 className="ssctl-h1">Nebula Store</h1>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[['items', 'Items'], ['rarity', 'Rarity Tiers']].map(([id, label]) => (
          <button key={id} className={`ssctl-btn ${tab === id ? '' : 'ssctl-btn-ghost'}`} style={{ minHeight: 36, fontSize: 13 }} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>
      {tab === 'items' ? <Items toast={toast} /> : <Rarity toast={toast} />}
      {toast.Toasts}
    </div>
  );
}
