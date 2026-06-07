/**
 * Web Vitals Reporter
 * Reports Core Web Vitals (LCP, FID/INP, CLS, TTFB) to console in development
 * In production, can be extended to send to analytics endpoint
 */

import { onCLS, onINP, onLCP, onTTFB, onFCP } from 'web-vitals';

const reportToConsole = ({ name, value, rating, delta, id }) => {
  console.log(`[Web Vitals] ${name}:`, {
    value: `${Math.round(value)}ms`,
    rating,
    delta: `${Math.round(delta)}ms`,
    id,
  });
};

const reportToAnalytics = ({ name, value, rating, delta, id }) => {
  // In production, send to your analytics endpoint
  // Example: fetch('/api/analytics/vitals', { method: 'POST', body: JSON.stringify({ name, value, rating, delta, id }) });
  
  // For now, just log in development
  if (import.meta.env.DEV) {
    reportToConsole({ name, value, rating, delta, id });
  }
};

export function initWebVitals() {
  if (import.meta.env.DEV) {
    // Report all Core Web Vitals
    onCLS(reportToAnalytics);
    onINP(reportToAnalytics);
    onLCP(reportToAnalytics);
    onTTFB(reportToAnalytics);
    onFCP(reportToAnalytics);
  }
}

export function measureScrollFPS(elementId = 'root', duration = 2000) {
  if (!import.meta.env.DEV) return;
  
  let frameCount = 0;
  let lastTime = performance.now();
  let running = true;
  
  const measure = () => {
    if (!running) return;
    
    frameCount++;
    const currentTime = performance.now();
    const elapsed = currentTime - lastTime;
    
    if (elapsed >= duration) {
      const fps = Math.round((frameCount / elapsed) * 1000);
      console.log(`[Scroll FPS] ${fps} fps over ${duration}ms`);
      running = false;
    } else {
      requestAnimationFrame(measure);
    }
  };
  
  console.log(`[Scroll FPS] Starting measurement for ${duration}ms...`);
  requestAnimationFrame(measure);
}

export function measureNotificationLatency(socketEmitTime) {
  if (!import.meta.env.DEV) return;
  
  const paintTime = performance.now();
  const latency = paintTime - socketEmitTime;
  console.log(`[Notification Latency] ${Math.round(latency)}ms from socket emit to UI paint`);
}
