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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
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
