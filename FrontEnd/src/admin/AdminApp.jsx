/**
 * AdminApp — entry point for the Command Center, mounted at the secret slug.
 * Probes the session via /auth/me: authenticated → AdminShell; otherwise →
 * AdminLogin. Renders nothing of the user app and pulls in only the scoped
 * admin theme.
 */
import { useCallback, useEffect, useState } from 'react';
import adminApi, { setAdminCsrf } from './adminApi';
import AdminLogin from './AdminLogin';
import AdminShell from './AdminShell';
import './admin.css';

export default function AdminApp() {
  const [state, setState] = useState('loading'); // loading | login | authed
  const [admin, setAdmin] = useState(null);

  const probe = useCallback(async () => {
    try {
      const { data } = await adminApi.get('/auth/me');
      setAdminCsrf(data.csrfToken);   // header source for mutations (cross-site cookie isn't JS-readable)
      setAdmin(data.admin);
      setState('authed');
    } catch {
      setAdminCsrf(null);
      setState('login');
    }
  }, []);

  // Probe runs once on mount; setState happens only after the awaited request
  // resolves (not synchronously), so the set-state-in-effect rule is a false
  // positive here.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { probe(); }, [probe]);

  return (
    <div className="ssctl">
      {state === 'loading' && (
        <div className="ssctl-center"><div className="ssctl-spin" /></div>
      )}
      {state === 'login' && <AdminLogin onAuthed={probe} />}
      {state === 'authed' && <AdminShell admin={admin} onLogout={() => { setAdmin(null); setState('login'); }} />}
    </div>
  );
}
