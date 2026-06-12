import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import './index.css';
import App from './App.jsx';
import ErrorBoundary from './components/common/ErrorBoundary.jsx';
import { useThemeStore } from './store/themeStore.js';
import { initWebVitals } from './utils/reportWebVitals.js';

// Initialize theme on app load
useThemeStore.getState().initializeTheme();

// Initialize Web Vitals reporting
initWebVitals();

// Retry transient failures (network errors + 5xx, including Render cold-start
// 502/503 bursts) with exponential backoff, but never retry 4xx — those are
// deterministic (401/403/404/422) and retrying just delays the real error.
// Render free-tier returns 503 *fast* (~0.5s) while an instance wakes from
// sleep, and a full cold start takes 30–60s. So the retry window must be wide
// enough to outlast that — up to 6 attempts with backoff capped at 15s gives
// a ~50s total window that bridges a cold start instead of giving up at ~7s.
const shouldRetry = (failureCount, error) => {
  const status = error?.response?.status;
  if (status && status >= 400 && status < 500) return false;
  return failureCount < 6;
};

const retryDelay = (attempt) => Math.min(1000 * 2 ** attempt, 15000);

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
