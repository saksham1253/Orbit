import React from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import './index.css';
import App from './App.jsx';
import ErrorBoundary from './components/common/ErrorBoundary.jsx';
import { useThemeStore } from './store/themeStore.js';
import { initWebVitals } from './utils/reportWebVitals.js';

// ── Global crash observability (esp. the APK) ──────────────────────────────
// The Android WebView can be killed by an uncaught error or an unhandled
// promise rejection with no visible React error screen — the app simply
// "closes". These listeners surface the real message + stack in `adb logcat`
// (and the on-device console), turning an invisible native close into a
// diagnosable line. They only log — they never swallow or alter behavior.
if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => {
    console.error('[global error]', e?.message, e?.error?.stack || '', e?.filename, e?.lineno);
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r = e?.reason;
    console.error('[unhandled rejection]', r?.message || r, r?.stack || '');
  });

  // Reload-loop detector — a purely diagnostic tripwire. If the document reloads
  // many times within a few seconds (the "logs in → app restarts again and
  // again" symptom), log it loudly so logcat shows the loop instead of a silent
  // flicker. Diagnostic only: it does not stop the reloads, so it can't mask a
  // real fix — it just makes the loop unmistakable in the logs.
  try {
    const KEY = '__reloadTrace';
    const now = Date.now();
    const trace = JSON.parse(sessionStorage.getItem(KEY) || '[]').filter((t) => now - t < 8000);
    trace.push(now);
    sessionStorage.setItem(KEY, JSON.stringify(trace));
    if (trace.length >= 4) {
      console.error(`[reload-loop] ${trace.length} reloads in <8s — the app is restarting in a loop (last path: ${window.location.pathname})`);
    }
  } catch { /* sessionStorage unavailable — skip the tripwire */ }
}

// Initialize theme on app load
useThemeStore.getState().initializeTheme();

// Initialize Web Vitals reporting
initWebVitals();

// Retry transient failures (network errors + 5xx, including Render cold-start
// 502/503 bursts) with exponential backoff, but never retry 4xx — those are
// deterministic (401/403/404/422) and retrying just delays the real error.
// Retry transient failures (network errors + 5xx) a couple of times with short
// backoff — enough to ride out a one-off blip, but NOT so long that a genuine
// outage leaves the user staring at a skeleton for a minute. Never retry 4xx
// (401/403/404/422 are deterministic).
const shouldRetry = (failureCount, error) => {
  const status = error?.response?.status;
  if (status && status >= 400 && status < 500) return false;
  return failureCount < 2;
};

const retryDelay = (attempt) => Math.min(1000 * 2 ** attempt, 4000);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: shouldRetry,
      retryDelay,
      staleTime: 60_000, // Consider data fresh for 1 minute
      gcTime: 5 * 60_000, // Keep unused data in cache for 5 minutes
    },
    mutations: {
      retry: 0,
    },
  },
});

// Run axe-core accessibility checks in development only
if (import.meta.env.DEV) {
  import('@axe-core/react').then(({ default: axe }) => {
    import('react-dom').then(({ default: ReactDOM }) => {
      axe(React, ReactDOM, 1000);
    });
  }).catch(() => {/* axe optional — ignore if unavailable */});
}

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </HelmetProvider>
  </ErrorBoundary>,
);
