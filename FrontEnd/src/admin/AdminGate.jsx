/**
 * AdminGate — decides, on the catch-all route, whether the visited path is the
 * secret admin slug WITHOUT the slug ever appearing in the client bundle.
 *
 * The build ships only VITE_ADMIN_SLUG_HASH (a SHA-256 hex of the slug, which is
 * irreversible). We hash the first path segment at runtime and compare. A match
 * lazy-loads the Command Center; anything else renders the normal 404. If the
 * hash env is unset, the gate is inert and every unknown path is a plain 404.
 *
 * The server remains the real security boundary (all admin APIs 404 without a
 * valid admin session); this is entry obscurity that leaks nothing.
 */
import { useEffect, useState, lazy, Suspense } from 'react';

const AdminApp = lazy(() => import('./AdminApp'));
const HASH = import.meta.env.VITE_ADMIN_SLUG_HASH;

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default function AdminGate({ fallback }) {
  const [match, setMatch] = useState(null); // null = deciding

  useEffect(() => {
    if (!HASH) return;
    const seg = window.location.pathname.replace(/^\/+/, '').split('/')[0] || '';
    let on = true;
    sha256Hex(seg).then((h) => { if (on) setMatch(h === HASH); }).catch(() => { if (on) setMatch(false); });
    return () => { on = false; };
  }, []);

  if (!HASH) return fallback;            // no admin configured → normal 404
  if (match === null) return null;       // deciding (a tick); avoids 404 flash on the slug
  if (!match) return fallback;
  return <Suspense fallback={null}><AdminApp /></Suspense>;
}
