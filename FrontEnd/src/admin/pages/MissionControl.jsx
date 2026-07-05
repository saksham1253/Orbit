/**
 * MissionControl — the Orbit gamification cockpit (admin). One page, tabbed, over
 * the /api/__ssctl/mission-control/* API. Every mutating call is RBAC-gated +
 * audited server-side; responses use the { ok, data, error } envelope.
 *
 * Tabs: Flags (C1) · Seeder+Warp (C2) · Pre-Flight (C8) · Simulator (C3) ·
 *       Inspector (C5) · Push (C9) · Telemetry (C7) · Lint (C4).
 */
import { useEffect, useState, useCallback } from 'react';
import adminApi from '../adminApi';
import {
  Rocket, ToggleLeft, FlaskConical, ClipboardCheck, Radar, User, Bell, Activity, ShieldCheck, Gauge,
} from 'lucide-react';

// Unwrap the standard { ok, data, error } envelope.
const unwrap = (r) => (r?.data?.data !== undefined ? r.data.data : r?.data);
const errText = (e) => e?.response?.data?.error?.message || e?.response?.data?.message || e.message || 'Error';

function Card({ title, children, right }) {
  return (
    <section style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 14, padding: 16, marginBottom: 14 }}>
      {title && <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>{title}</h3>
        <div style={{ marginLeft: 'auto' }}>{right}</div>
      </div>}
      {children}
    </section>
  );
}
const btn = { padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,.15)', background: 'rgba(255,255,255,.06)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 };
const input = { padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,.15)', background: 'rgba(0,0,0,.25)', color: '#fff', fontSize: 13 };
const pill = (ok) => ({ padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: ok ? 'rgba(16,185,129,.15)' : 'rgba(244,63,94,.15)', color: ok ? '#34d399' : '#fb7185' });

// ── C1 Flag Cockpit ──────────────────────────────────────────────────────────
function FlagCockpit() {
  const [flags, setFlags] = useState(null);
  const [msg, setMsg] = useState('');
  const load = useCallback(() => adminApi.get('/mission-control/flags').then((r) => setFlags(unwrap(r).flags)).catch((e) => setMsg(errText(e))), []);
  useEffect(() => { load(); }, [load]);

  const set = async (key, value) => {
    setMsg('');
    try { await adminApi.patch('/mission-control/flags', { key, value }); load(); }
    catch (e) { setMsg(errText(e)); }
  };
  if (!flags) return <Card title="Feature Flags"><div style={{ opacity: .6 }}>Loading…</div></Card>;

  return (
    <Card title="Feature Flags — live, no redeploy" right={<button style={btn} onClick={load}>Refresh</button>}>
      {msg && <div style={{ color: '#fb7185', marginBottom: 8 }}>{msg}</div>}
      <div style={{ display: 'grid', gap: 8 }}>
        {flags.map((f) => (
          <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 8, borderRadius: 8, background: f.overridden ? 'rgba(251,191,36,.06)' : 'transparent' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{f.key} {f.overridden && <span style={{ fontSize: 10, color: '#fbbf24' }}>· overridden</span>}</div>
              <div style={{ fontSize: 11, opacity: .6 }}>{f.description} · default {String(f.default)}</div>
            </div>
            {f.type === 'bool' ? (
              <button style={{ ...btn, background: f.value ? 'rgba(16,185,129,.2)' : 'rgba(255,255,255,.06)' }} onClick={() => set(f.key, !f.value)}>
                {f.value ? 'ON' : 'OFF'}
              </button>
            ) : (
              <input style={{ ...input, width: 80 }} type="number" defaultValue={f.value} min={0} max={f.type === 'pct' ? 100 : undefined}
                onBlur={(e) => Number(e.target.value) !== f.value && set(f.key, Number(e.target.value))} />
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── C2 Seeder + Warp ─────────────────────────────────────────────────────────
function SeederWarp() {
  const [userId, setUserId] = useState('');
  const [out, setOut] = useState(null);
  const [busy, setBusy] = useState('');
  const call = async (label, fn) => { setBusy(label); setOut(null); try { setOut(unwrap(await fn())); } catch (e) { setOut({ error: errText(e) }); } finally { setBusy(''); } };
  const warp = (op, value) => call(op, () => adminApi.post('/mission-control/warp', { userId, op, value, confirm: 'SEED' }));

  return (
    <Card title="Seeder + Warp Drive">
      <input style={{ ...input, width: 320, marginBottom: 10 }} placeholder="target userId" value={userId} onChange={(e) => setUserId(e.target.value)} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        <button style={btn} disabled={!userId || busy} onClick={() => call('seed', () => adminApi.post('/mission-control/seed', { userId, confirm: 'SEED' }))}>🌱 Seed all tiers</button>
        <button style={btn} disabled={!userId || busy} onClick={() => warp('advance')}>+1 day</button>
        <button style={btn} disabled={!userId || busy} onClick={() => warp('miss')}>Simulate miss</button>
        <button style={btn} disabled={!userId || busy} onClick={() => warp('jumpMilestone', 100)}>Jump → 100</button>
        <button style={btn} disabled={!userId || busy} onClick={() => warp('rollover')}>Run rollover</button>
        <button style={{ ...btn, borderColor: 'rgba(244,63,94,.4)' }} disabled={!userId || busy} onClick={() => call('teardown', () => adminApi.post('/mission-control/teardown', { userId, confirm: 'SEED' }))}>Teardown</button>
      </div>
      {busy && <div style={{ opacity: .6 }}>Running {busy}…</div>}
      {out && <pre style={{ fontSize: 11, background: 'rgba(0,0,0,.3)', padding: 10, borderRadius: 8, overflow: 'auto', maxHeight: 260 }}>{JSON.stringify(out, null, 2)}</pre>}
    </Card>
  );
}

// ── C8 Pre-Flight ────────────────────────────────────────────────────────────
function PreFlight() {
  const [res, setRes] = useState(null);
  const run = () => adminApi.post('/mission-control/preflight/run', {}).then((r) => setRes(unwrap(r))).catch((e) => setRes({ error: errText(e) }));
  return (
    <Card title="Pre-Flight Checks" right={<button style={btn} onClick={run}>Run all</button>}>
      {!res ? <div style={{ opacity: .6 }}>Run to see the board.</div> : res.error ? <div style={{ color: '#fb7185' }}>{res.error}</div> : (
        <>
          <div style={{ marginBottom: 8 }}><span style={pill(res.green)}>{res.green ? 'ALL GREEN' : 'ATTENTION'}</span></div>
          <div style={{ display: 'grid', gap: 6 }}>
            {res.results.map((r) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                <span style={pill(r.status === 'pass')}>{r.status}</span>
                <span style={{ fontWeight: 600 }}>{r.id}</span>
                <span style={{ marginLeft: 'auto', opacity: .5, fontSize: 11 }}>{JSON.stringify(r.evidence)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

// ── C3 Simulator ─────────────────────────────────────────────────────────────
function Simulator() {
  const [targets, setTargets] = useState('p1');
  const [count, setCount] = useState(20);
  const [res, setRes] = useState(null);
  const run = () => adminApi.post('/mission-control/sim/anti-gaming', { targets: targets.split(',').map((s) => s.trim()).filter(Boolean), count: Number(count) })
    .then((r) => setRes(unwrap(r))).catch((e) => setRes({ error: errText(e) }));
  return (
    <Card title="Anti-Gaming Simulator (no DB writes)">
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <input style={{ ...input, width: 240 }} value={targets} onChange={(e) => setTargets(e.target.value)} placeholder="targets (comma-sep)" />
        <input style={{ ...input, width: 80 }} type="number" value={count} onChange={(e) => setCount(e.target.value)} />
        <button style={btn} onClick={run}>Simulate</button>
        <button style={btn} onClick={() => { setTargets('p1'); setCount(20); }}>Preset: 20→same</button>
        <button style={btn} onClick={() => { setTargets('a,b,c,d,e'); setCount(5); }}>Preset: 5→diff</button>
      </div>
      {res && (res.error ? <div style={{ color: '#fb7185' }}>{res.error}</div> : (
        <>
          <div style={{ fontSize: 12, marginBottom: 6 }}>streak days: <b>{res.totals.streakDaysGranted}</b> · XP total: <b>{res.totals.xpTotal}</b> · distinct credited: <b>{res.totals.distinctPartnersCredited}</b></div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>{res.assertions.map((a) => <span key={a.name} style={pill(a.pass)}>{a.name}</span>)}</div>
          <pre style={{ fontSize: 11, background: 'rgba(0,0,0,.3)', padding: 10, borderRadius: 8, overflow: 'auto', maxHeight: 200 }}>{res.perMessage.map((m) => `#${m.i} ${m.partner} streak=${m.countedForStreak} xp=${m.xp} (${m.reason})`).join('\n')}</pre>
        </>
      ))}
    </Card>
  );
}

// ── C5 Inspector ─────────────────────────────────────────────────────────────
function Inspector() {
  const [userId, setUserId] = useState('');
  const [data, setData] = useState(null);
  const load = () => adminApi.get(`/mission-control/users/${userId}/orbit`).then((r) => setData(unwrap(r))).catch((e) => setData({ error: errText(e) }));
  return (
    <Card title="Player Inspector">
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <input style={{ ...input, width: 320 }} placeholder="userId" value={userId} onChange={(e) => setUserId(e.target.value)} />
        <button style={btn} disabled={!userId} onClick={load}>Inspect</button>
      </div>
      {data && (data.error ? <div style={{ color: '#fb7185' }}>{data.error}</div> : (
        <div style={{ fontSize: 13, display: 'grid', gap: 4 }}>
          <div><b>{data.user.name}</b> · {data.user.email}</div>
          <div>Streak <b>{data.orbit.streak.current}</b> (longest {data.orbit.streak.longest}) · phase <b>{data.orbit.streak.phase}</b> {data.orbit.streak.badge && <span style={pill(true)}>{data.orbit.streak.badge}</span>}</div>
          <div>Photons <b>{data.orbit.photons ?? data.orbit.stardust}</b> · League <b>{data.league.division.name}</b> ({data.league.weekXp} XP) · CosmicScore {data.cosmic.score ?? '—'}</div>
          <div>Binary Stars: {data.constellations.length ? data.constellations.map((c) => `${c.partner} (${c.streak}d)`).join(', ') : '—'}</div>
          <div>Mastery: {data.mastery.length ? data.mastery.map((m) => m.badge).join(', ') : '—'}</div>
        </div>
      ))}
    </Card>
  );
}

// ── C9 Push Bench ────────────────────────────────────────────────────────────
function PushBench() {
  const [userId, setUserId] = useState('');
  const [eventType, setEventType] = useState('message');
  const [out, setOut] = useState('');
  const send = async () => { setOut(''); try { setOut(JSON.stringify(unwrap(await adminApi.post('/mission-control/push/test', { userId, eventType })))); } catch (e) { setOut(errText(e)); } };
  return (
    <Card title="Push Test Bench">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input style={{ ...input, width: 280 }} placeholder="userId" value={userId} onChange={(e) => setUserId(e.target.value)} />
        <select style={input} value={eventType} onChange={(e) => setEventType(e.target.value)}>
          {['message', 'connection_request', 'incoming_call', 'constellation_your_turn', 'orbit_decay'].map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button style={btn} disabled={!userId} onClick={send}>Send test push</button>
      </div>
      {out && <div style={{ fontSize: 12, marginTop: 8, opacity: .8 }}>{out}</div>}
    </Card>
  );
}

// ── C7 Telemetry ─────────────────────────────────────────────────────────────
function Telemetry() {
  const [events, setEvents] = useState([]);
  const load = useCallback(() => adminApi.get('/mission-control/analytics/recent?limit=60').then((r) => setEvents(unwrap(r).events || [])).catch(() => {}), []);
  useEffect(() => { load(); const id = setInterval(load, 5000); return () => clearInterval(id); }, [load]);
  return (
    <Card title="Telemetry — live event stream" right={<span style={{ fontSize: 11, opacity: .5 }}>auto-refresh 5s</span>}>
      {events.length === 0 ? <div style={{ opacity: .6 }}>No events yet — act in the app.</div> : (
        <pre style={{ fontSize: 11, background: 'rgba(0,0,0,.3)', padding: 10, borderRadius: 8, overflow: 'auto', maxHeight: 320 }}>
          {events.map((e) => `${e.at?.slice(11, 19)} ${e.evt}${e.userId ? ' u=' + String(e.userId).slice(-6) : ''}`).join('\n')}
        </pre>
      )}
    </Card>
  );
}

// ── C4 Lint ──────────────────────────────────────────────────────────────────
function Lint() {
  const [res, setRes] = useState(null);
  const run = () => adminApi.get('/mission-control/notifications/lint').then((r) => setRes(unwrap(r))).catch((e) => setRes({ error: errText(e) }));
  useEffect(() => { run(); }, []);
  return (
    <Card title="Notification Copy Linter" right={<button style={btn} onClick={run}>Re-run</button>}>
      {!res ? <div style={{ opacity: .6 }}>Loading…</div> : res.error ? <div style={{ color: '#fb7185' }}>{res.error}</div> : (
        <div>
          <span style={pill(res.clean)}>{res.clean ? 'CLEAN — no shame phrases' : 'FLAGGED'}</span>
          {res.hits && <pre style={{ fontSize: 11, marginTop: 8 }}>{res.hits.join('\n')}</pre>}
          {res.scanned && <div style={{ fontSize: 11, opacity: .5, marginTop: 6 }}>Scanned {res.scanned} source files.</div>}
        </div>
      )}
    </Card>
  );
}

// ── C6 Gravimeter (economy) ──────────────────────────────────────────────────
function Gravimeter() {
  const [data, setData] = useState(null);
  const load = useCallback(() => adminApi.get('/mission-control/economy/photons').then((r) => setData(unwrap(r))).catch((e) => setData({ error: errText(e) })), []);
  useEffect(() => { load(); }, [load]);
  if (!data) return <Card title="Gravimeter — Photons economy"><div style={{ opacity: .6 }}>Loading…</div></Card>;
  if (data.error) return <Card title="Gravimeter — Photons economy"><div style={{ color: '#fb7185' }}>{data.error}</div></Card>;
  return (
    <Card title="Gravimeter — Photons economy" right={<button style={btn} onClick={load}>Refresh</button>}>
      {data.inflationAlert && <div style={{ ...pill(false), display: 'inline-block', marginBottom: 8 }}>⚠ INFLATION: supply outpacing sinks</div>}
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 12 }}>
        <div><div style={{ fontSize: 11, opacity: .5 }}>Earned</div><div style={{ fontSize: 20, fontWeight: 800, color: '#34d399' }}>{data.totalEarned}</div></div>
        <div><div style={{ fontSize: 11, opacity: .5 }}>Spent</div><div style={{ fontSize: 20, fontWeight: 800, color: '#fb7185' }}>{data.totalSpent}</div></div>
        <div><div style={{ fontSize: 11, opacity: .5 }}>Net supply</div><div style={{ fontSize: 20, fontWeight: 800 }}>{data.netSupply}</div></div>
        <div><div style={{ fontSize: 11, opacity: .5 }}>Sink ratio</div><div style={{ fontSize: 20, fontWeight: 800 }}>{data.sinkRatio}</div></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12 }}>
        <div><b>Sources</b><pre style={{ fontSize: 11 }}>{JSON.stringify(data.sources, null, 2)}</pre></div>
        <div><b>Sinks</b><pre style={{ fontSize: 11 }}>{JSON.stringify(data.sinks, null, 2)}</pre></div>
      </div>
    </Card>
  );
}

const TABS = [
  { id: 'flags', label: 'Flags', Icon: ToggleLeft, Comp: FlagCockpit },
  { id: 'economy', label: 'Gravimeter', Icon: Gauge, Comp: Gravimeter },
  { id: 'seeder', label: 'Seeder + Warp', Icon: Rocket, Comp: SeederWarp },
  { id: 'preflight', label: 'Pre-Flight', Icon: ClipboardCheck, Comp: PreFlight },
  { id: 'sim', label: 'Simulator', Icon: FlaskConical, Comp: Simulator },
  { id: 'inspector', label: 'Inspector', Icon: User, Comp: Inspector },
  { id: 'push', label: 'Push', Icon: Bell, Comp: PushBench },
  { id: 'telemetry', label: 'Telemetry', Icon: Activity, Comp: Telemetry },
  { id: 'lint', label: 'Lint', Icon: ShieldCheck, Comp: Lint },
];

export default function MissionControl() {
  const [tab, setTab] = useState('flags');
  const Active = (TABS.find((t) => t.id === tab) || TABS[0]).Comp;
  return (
    <div>
      <h1 className="ssctl-h1" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Radar size={20} /> Mission Control</h1>
      <p style={{ opacity: .6, fontSize: 13, marginTop: -4 }}>Orbit gamification cockpit — every tier verifiable & controllable in seconds.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '12px 0 16px' }}>
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ ...btn, display: 'flex', alignItems: 'center', gap: 6, background: tab === id ? 'rgba(124,58,237,.3)' : 'rgba(255,255,255,.06)' }}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>
      <Active />
    </div>
  );
}
