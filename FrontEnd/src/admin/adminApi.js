/**
 * adminApi — isolated axios instance for the Admin Command Center.
 *
 * Deliberately separate from the user `services/api.js`: it sends cookies
 * (withCredentials) instead of the user JWT, talks only to the unguessable
 * `/api/__ssctl` base, and attaches the double-submit CSRF header on mutations.
 * It never touches the user auth store.
 */
import axios from 'axios';

// Same API origin as the user app, namespaced under the hidden admin base.
const USER_API = import.meta.env.VITE_API_URL ||
  (import.meta.env.PROD ? 'https://skillswap-backend-mb4k.onrender.com/api' : '/api');
const ADMIN_BASE = `${USER_API}/__ssctl`;

const adminApi = axios.create({
  baseURL: ADMIN_BASE,
  withCredentials: true,
  timeout: 30000,
});

function readCookie(name) {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[.$?*|{}()[\]\\/+^]/g, '\\$&') + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}

// CSRF double-submit: the server sets `ssctl_csrf` on ITS domain and also returns
// the same value in the login / `/auth/me` response bodies. On a SPLIT deployment
// (frontend on Vercel, backend on Render) `document.cookie` can't read a cookie
// scoped to the backend domain, so reading the cookie returns null and every
// mutation would 404. We therefore remember the token the server told us and send
// THAT as the header — the browser still attaches the matching cookie itself
// (SameSite=None), so cookie === header holds. Cookie read is kept as a fallback
// for same-origin/local dev. Persisted to sessionStorage so a reload before the
// next `/auth/me` still has it.
let csrfToken = null;
try { csrfToken = sessionStorage.getItem('ssctl_csrf') || null; } catch { /* no sessionStorage */ }

export function setAdminCsrf(token) {
  csrfToken = token || null;
  try {
    if (token) sessionStorage.setItem('ssctl_csrf', token);
    else sessionStorage.removeItem('ssctl_csrf');
  } catch { /* no sessionStorage */ }
}

// Attach CSRF token (double-submit) on state-changing requests.
adminApi.interceptors.request.use((config) => {
  const method = (config.method || 'get').toLowerCase();
  if (!['get', 'head', 'options'].includes(method)) {
    const csrf = csrfToken || readCookie('ssctl_csrf');
    if (csrf) config.headers['x-ssctl-csrf'] = csrf;
  }
  return config;
});

export default adminApi;
