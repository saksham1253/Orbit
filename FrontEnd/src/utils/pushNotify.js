// FrontEnd/src/utils/pushNotify.js
//
// FCM push registration for the native Android app (Capacitor). This is the
// killed-app delivery path: the backend sends via FCM (services/fcm.js) so a
// tray entry appears even when the app process is dead — something the live
// Socket.io path (and @capacitor/local-notifications) can't do.
//
// Everything is a no-op on the web build (Capacitor.isNativePlatform() is
// false), so the same calls are safe from shared components. The token is
// registered with the backend so it can target this device; on logout we tell
// the backend to drop it.

import { Capacitor } from '@capacitor/core';
import api from '../services/api';

const isNative = (() => {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
})();

// FCM registration is gated on Firebase ACTUALLY being configured for this build.
// Without a valid google-services.json in the Android build, Firebase never
// initializes, and calling PushNotifications.register() makes the native
// FirebaseMessaging layer throw "Default FirebaseApp is not initialized" — which
// crashes the WHOLE app to the home screen (a native exception JS try/catch
// cannot stop). That surfaced as "the APK closes every time I log in", because
// this runs on every authed mount.
//
// __FCM_CONFIGURED__ is injected by vite.config.js: it is true ONLY when a
// structurally-valid google-services.json for appId app.orbit.mobile is present
// at build time. This is authoritative and needs no manual env coordination — a
// build without Firebase configured simply can't turn push on, so it can't crash.
// VITE_ENABLE_PUSH="false" can still force push OFF even on a configured build
// (kill switch); it can never force it ON when Firebase is absent.
const FCM_CONFIGURED = (() => {
  try { return typeof __FCM_CONFIGURED__ !== 'undefined' && __FCM_CONFIGURED__ === true; }
  catch { return false; }
})();
const PUSH_FORCED_OFF = (() => {
  try { return String(import.meta.env.VITE_ENABLE_PUSH).toLowerCase() === 'false'; }
  catch { return false; }
})();
const PUSH_ENABLED = FCM_CONFIGURED && !PUSH_FORCED_OFF;

let onOpenLink = null;
let lastToken = null;
let pushStarted = false; // one-shot: never re-attempt within a session

/**
 * Request permission, register with FCM, and wire the tap handler. Call from a
 * top-level effect (App.jsx) once the user is authed, passing the router
 * navigate fn so tapping a push routes to the right screen.
 * @param {(link: string) => void} navigateFn
 */
export async function initPushNotifications(navigateFn) {
  onOpenLink = typeof navigateFn === 'function' ? navigateFn : null;
  if (!isNative) return;
  // Opt-in only + one-shot. Skipping this when push isn't configured is what
  // prevents the every-login native crash (see PUSH_ENABLED note above).
  if (!PUSH_ENABLED || pushStarted) return;
  // Defensive: never touch the plugin if the native side isn't even present.
  try { if (!Capacitor.isPluginAvailable('PushNotifications')) return; } catch { return; }
  pushStarted = true;

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    let perm = await PushNotifications.checkPermissions();
    if (perm.receive !== 'granted') {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== 'granted') return;

    // Idempotent across re-init (login/logout cycles, hot reload).
    await PushNotifications.removeAllListeners();

    // FCM handed us a device token → persist it on the backend for targeting.
    await PushNotifications.addListener('registration', async (token) => {
      const value = token && token.value;
      if (!value || value === lastToken) return;
      lastToken = value;
      try { await api.post('/device/token', { token: value }); } catch { /* best-effort */ }
    });

    await PushNotifications.addListener('registrationError', () => {
      /* nothing actionable client-side; push just stays off for this session */
    });

    // Tap on a tray entry → route to its link. On a cold start this fires after
    // the app boots, so navigation lands once the router is ready.
    await PushNotifications.addListener('pushNotificationActionPerformed', (event) => {
      const link = event?.notification?.data?.link;
      if (link && onOpenLink) onOpenLink(link);
    });

    // Foreground receipt: intentionally do nothing. The live socket path already
    // shows the in-app flash + a local notification, so acting here would double
    // up. Background/killed entries are auto-displayed by Android from the
    // `notification` payload the server sends.

    await PushNotifications.register();
  } catch {
    /* best-effort — never block app startup on push setup */
  }
}

/**
 * Drop this device's token on the backend (logout). Best-effort; safe on web.
 */
export async function unregisterPush() {
  if (!isNative || !lastToken) return;
  try {
    await api.delete('/device/token', { data: { token: lastToken } });
  } catch {
    /* ignore */
  }
  lastToken = null;
}
