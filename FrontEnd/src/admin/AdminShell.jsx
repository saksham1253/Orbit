/**
 * AdminShell — the authenticated Command Center frame: left nav rail + top bar +
 * a content area that switches between sections. Sections are added across the
 * later commits; each unbuilt one renders a clear placeholder.
 */
import { useState } from 'react';
import {
  LayoutDashboard, Users, Sparkles, Clapperboard, ShieldAlert, Database, ScrollText,
  SlidersHorizontal, LogOut, Lock,
} from 'lucide-react';
import adminApi from './adminApi';
import Overview from './pages/Overview';
import UsersPage from './pages/Users';
import Cosmic from './pages/Cosmic';
import MomentLab from './pages/MomentLab';
import Records from './pages/Records';
import Audit from './pages/Audit';
import Moderation from './pages/Moderation';
import System from './pages/System';

const SECTIONS = [
  { id: 'overview', label: 'Overview', Icon: LayoutDashboard, Comp: Overview },
  { id: 'users', label: 'Users', Icon: Users, Comp: UsersPage },
  { id: 'cosmic', label: 'Cosmic', Icon: Sparkles, Comp: Cosmic },
  { id: 'momentlab', label: 'Moment Lab', Icon: Clapperboard, Comp: MomentLab },
  { id: 'moderation', label: 'Moderation', Icon: ShieldAlert, Comp: Moderation },
  { id: 'records', label: 'Records', Icon: Database, Comp: Records },
  { id: 'audit', label: 'Audit Log', Icon: ScrollText, Comp: Audit },
  { id: 'system', label: 'System', Icon: SlidersHorizontal, Comp: System },
];

function Placeholder({ label }) {
  return (
    <div>
      <h1 className="ssctl-h1">{label}</h1>
      <div className="ssctl-card ssctl-muted">This section is being built in a later commit.</div>
    </div>
  );
}

export default function AdminShell({ admin, onLogout }) {
  const [section, setSection] = useState('overview');
  const active = SECTIONS.find((s) => s.id === section) || SECTIONS[0];

  const doLogout = async () => {
    try { await adminApi.post('/auth/logout'); } catch { /* ignore */ }
    onLogout();
  };

  return (
    <div className="ssctl-shell">
      <nav className="ssctl-rail">
        <div className="ssctl-brand"><Lock size={16} color="var(--ss-accent)" /> Command Center</div>
        {SECTIONS.map(({ id, label, Icon }) => (
          <button key={id} className={`ssctl-navitem ${id === section ? 'active' : ''}`} onClick={() => setSection(id)}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </nav>
      <div className="ssctl-main">
        <div className="ssctl-topbar">
          <span className="ssctl-muted" style={{ fontSize: 13 }}>
            Signed in as <strong style={{ color: 'var(--ss-text)' }}>{admin?.email}</strong>
          </span>
          <button className="ssctl-btn ssctl-btn-ghost" style={{ minHeight: 36, padding: '7px 14px' }} onClick={doLogout}>
            <LogOut size={15} /> Log out
          </button>
        </div>
        <div className="ssctl-content">
          {active.Comp ? <active.Comp /> : <Placeholder label={active.label} />}
        </div>
      </div>
    </div>
  );
}
