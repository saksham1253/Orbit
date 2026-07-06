import axios from 'axios';
import { useAuthStore } from '../store/authStore';

// True when running inside the Capacitor native shell (APK), false on the web.
// Read once; used to request a long-lived session on the APK (see interceptor).
let IS_NATIVE = false;
try {
  // Lazy require so the web bundle doesn't hard-depend on the plugin at import time.
  // eslint-disable-next-line global-require
  IS_NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
} catch { IS_NATIVE = false; }

const api = axios.create({
  // Fallback to absolute Render URL in production if VITE_API_URL is missing/malformed
  baseURL: import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://skillswap-backend-mb4k.onrender.com/api' : '/api'),
  // Generous timeout so a Render free-tier cold start (instance waking from
  // sleep, ~30–60s) doesn't abort before the server is ready to respond.
  timeout: 45000,
  // Auth is Bearer-token only (the backend sets NO cookies for the user app —
  // only the separate admin panel uses cookies, via its own adminApi client).
  // Sending credentials from the Capacitor WebView origin (https://localhost) to
  // the cross-origin API marks every request "third-party", which Android's
  // WebView blocks — that was breaking email login/signup in the APK while OAuth
  // (deep-link token, no XHR) survived. Bearer tokens need no credentials.
  withCredentials: false,
});

// Request interceptor: attach JWT + signal the client platform so the backend
// can issue a long-lived (30d) session for the trusted APK install while the
// website keeps its short 1-day session.
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (IS_NATIVE) {
    config.headers['X-Client-Platform'] = 'native';
  }
  return config;
});

// Response interceptor: handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && window.location.pathname !== '/login') {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
