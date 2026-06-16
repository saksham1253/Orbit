/**
 * Overview — the Command Center landing dashboard: KPIs, tier distribution
 * (inline SVG bar chart — no chart dependency), the current North Star, recent
 * signups, and the latest rank-up/down moments.
 */
import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Crown } from 'lucide-react';
import adminApi from '../adminApi';

const TIER_COLORS = {
  stardust: '#6b7280', meteor: '#b45309', asteroid: '#a16207', moon: '#cbd5e1',
  planet: '#3b82f6', star: '#eab308', pulsar: '#06b6d4', supernova: '#f97316',
  galaxy: '#a855f7', quasar: '#ec4899',
};

function Kpi({ value, label }) {
  return (
    <div className="ssctl-kpi">
      <div className="v">{value ?? '—'}</div>
      <div className="l">{label}</div>
    </div>
  );
}

function TierBars({ data }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <svg width="100%" height="180" role="img" aria-label="Tier distribution" style={{ overflow: 'visible' }}>
      {data.map((d, i) => {
        const bw = 100 / data.length;
        const x = i * bw;
        const h = (d.count / max) * 130;
        return (
          <g key={d.category}>
            <rect x={`${x + bw * 0.15}%`} y={150 - h} width={`${bw * 0.7}%`} height={h}
              rx="3" fill={TIER_COLORS[d.category] || '#4f9dff'} />
            <text x={`${x + bw * 0.5}%`} y={150 - h - 5} textAnchor="middle" fontSize="11" fill="var(--ss-text)">{d.count}</text>
            <text x={`${x + bw * 0.5}%`} y="168" textAnchor="middle" fontSize="9" fill="var(--ss-text-dim)">{d.category.slice(0, 4)}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function Overview() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let on = true;
    adminApi.get('/overview')
      .then((r) => { if (on) setData(r.data); })
      .catch((e) => { if (on) setErr(e?.response?.data?.message || 'Failed to load.'); });
    return () => { on = false; };
  }, []);

  if (err) return <div className="ssctl-card ssctl-err">{err}</div>;
  if (!data) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="ssctl-spin" /></div>;

  const k = data.kpis;
  return (
    <div>
      <h1 className="ssctl-h1">Overview</h1>

      <div className="ssctl-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', marginBottom: 18 }}>
        <Kpi value={k.totalUsers} label="Total users" />
        <Kpi value={k.activeUsers} label="Active" />
        <Kpi value={k.newUsers7d} label="New (7d)" />
        <Kpi value={k.newUsers30d} label="New (30d)" />
        <Kpi value={k.totalSwaps} label="Completed swaps" />
        <Kpi value={k.totalCalls} label="Calls" />
        <Kpi value={k.openReports} label="Open reports" />
        <Kpi value={k.banned} label="Banned" />
      </div>

      <div className="ssctl-grid" style={{ gridTemplateColumns: '1.4fr 1fr', alignItems: 'start' }}>
        <div className="ssctl-card">
          <p className="ssctl-section-title">Tier distribution</p>
          <TierBars data={data.tierDistribution} />
        </div>

        <div className="ssctl-card">
          <p className="ssctl-section-title">North Star (top CosmicScore)</p>
          {data.northStar ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Crown size={28} color="#FFD479" />
              <div>
                <div style={{ fontWeight: 700 }}>{data.northStar.name}</div>
                <div className="ssctl-muted" style={{ fontSize: 13 }}>
                  CosmicScore {Math.round((data.northStar.cosmic?.score || 0) * 10) / 10}
                  {data.northStar.city ? ` · ${data.northStar.city}` : ''}
                </div>
              </div>
            </div>
          ) : <div className="ssctl-muted">No mentors yet.</div>}
        </div>
      </div>

      <div className="ssctl-grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 18, alignItems: 'start' }}>
        <div className="ssctl-card">
          <p className="ssctl-section-title">Recent signups</p>
          <table className="ssctl-table">
            <thead><tr><th>Name</th><th>Email</th><th>Status</th></tr></thead>
            <tbody>
              {data.recentSignups.map((u) => (
                <tr key={u._id}>
                  <td>{u.name}</td>
                  <td className="ssctl-muted">{u.email}</td>
                  <td><span className={`ssctl-badge ssctl-badge-${u.status}`}>{u.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="ssctl-card">
          <p className="ssctl-section-title">Latest rank moments</p>
          {data.recentRankEvents.length === 0 ? (
            <div className="ssctl-muted">No rank events recorded yet.</div>
          ) : (
            <table className="ssctl-table">
              <thead><tr><th>User</th><th>Move</th><th>Dir</th></tr></thead>
              <tbody>
                {data.recentRankEvents.map((e) => (
                  <tr key={e._id}>
                    <td>{e.userId?.name || '—'}</td>
                    <td className="ssctl-muted">{e.fromTierId} → {e.toTierId}</td>
                    <td>
                      <span className={`ssctl-badge ssctl-badge-${e.direction}`}>
                        {e.direction === 'up' ? <TrendingUp size={11} /> : <TrendingDown size={11} />} {e.direction}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
