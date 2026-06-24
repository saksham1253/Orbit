import { Capacitor } from '@capacitor/core';
import api from './api';
import { useAuthStore } from '../store/authStore';

/**
 * Native (Capacitor) social-login helpers.
 *
 * Google blocks OAuth inside embedded webviews ("disallowed_useragent"), so in
 * the APK we open the provider page in the SYSTEM browser and pass `client=app`.
 * The backend then redirects to `orbit://oauth/callback?token=...`, which the
 * deep-link listener below catches to finish sign-in. On the web, the normal
 * <a href> full-page redirect is used unchanged.
 */

export const isNativeApp = () => Capacitor.isNativePlatform();

const API_BASE =
  import.meta.env.VITE_API_URL?.replace('/api', '') ||
  (import.meta.env.PROD ? 'https://skillswap-backend-mb4k.onrender.com' : 'http://localhost:8000');

/** Open a provider's OAuth flow in the system browser (native only). */
export async function startNativeOAuth(provider) {
  const { Browser } = await import('@capacitor/browser');
  await Browser.open({ url: `${API_BASE}/api/auth/${provider}?client=app` });
}

/**
 * onClick for an OAuth <a>. Native → intercept and open the system browser.
 * Web → return without preventing default so the href redirect proceeds.
 */
export function oauthClickHandler(provider) {
  return (e) => {
    if (!isNativeApp()) return;
    e.preventDefault();
    startNativeOAuth(provider);
  };
}

/** Store token + hydrate the user, mirroring OAuthCallback.jsx. */
async function finishSignIn(token) {
  const { setToken, setUser } = useAuthStore.getState();
  setToken(token);
  try {
    const { data } = await api.get('/user/profile', { headers: { Authorization: `Bearer ${token}` } });
    setUser(data);
  } catch {
    /* token is valid even if the profile fetch blips — proceed */
  }
  // Full navigation reliably re-mounts the app at the authed route in the WebView.
  window.location.assign('/dashboard');
}

/**
 * Register the deep-link listener that completes OAuth on return from the
 * system browser. No-op on web. Returns a cleanup function.
 */
export async function initDeepLinkAuth() {
  if (!isNativeApp()) return () => {};
  const { App } = await import('@capacitor/app');
  const handle = await App.addListener('appUrlOpen', async ({ url }) => {
    if (!url || !url.includes('oauth/callback')) return;
    try {
      const params = new URLSearchParams(url.split('?')[1] || '');
      const token = params.get('token');
      try {
        const { Browser } = await import('@capacitor/browser');
        await Browser.close();
      } catch { /* browser may already be closed */ }
      if (token) await finishSignIn(token);
    } catch {
      /* ignore malformed deep links */
    }
  });
  return () => handle.remove();
}
