// FrontEnd/src/utils/nativeNotify.js
//
// Native Android (APK) notification-bar support via Capacitor LocalNotifications.
//
// The in-app system (toasts + sound + bell badge) only paints INSIDE the
// WebView — nothing ever reached the real Android notification tray, so on the
// APK a perfect match or a new message produced a sound + badge but no tray
// entry. This module posts a genuine system notification whenever a live socket
// event arrives while the app process is alive (foreground OR backgrounded but
// not killed). Delivery after the app is fully killed needs FCM push — a
// separate, larger piece of work.
//
// Everything here is a no-op on the web build (Capacitor.isNativePlatform() is
// false), so the same calls are safe to make from shared components.

import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const isNative = (() => {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
})();

let permissionReady = false;
let onOpenLink = null;
let idSeq = 1;

export function isNativeApp() {
  return isNative;
}

/**
 * Request permission once and register the tap handler. Call from a top-level
 * effect (App.jsx) and pass a router navigate fn so tapping a notification
 * routes to the right screen.
 * @param {(link: string) => void} navigateFn
 */
export async function initNativeNotifications(navigateFn) {
  onOpenLink = typeof navigateFn === 'function' ? navigateFn : null;
  if (!isNative) return;

  try {
    let perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') {
      perm = await LocalNotifications.requestPermissions(); // Android 13+ POST_NOTIFICATIONS prompt
    }
    permissionReady = perm.display === 'granted';

    // Tap on a notification → route to its stored link. Re-register cleanly so a
    // hot reload / re-init never stacks duplicate listeners.
    await LocalNotifications.removeAllListeners();
    await LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
      const link = event?.notification?.extra?.link;
      if (link && onOpenLink) onOpenLink(link);
    });
  } catch {
    /* best-effort — never block app startup on notification setup */
  }
}

/**
 * Post a system notification to the Android tray. No-op on web or without
 * permission. Safe to call from anywhere; failures are swallowed.
 * @param {{ title?: string, body?: string, link?: string }} opts
 */
export async function postNativeNotification({ title, body, link } = {}) {
  if (!isNative || !permissionReady) return;
  try {
    // 32-bit positive id required by Android; wrap so a long session never overflows.
    const id = (idSeq = idSeq % 2147480000 + 1);
    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title: title || 'Orbit',
          body: body || '',
          // Omitting smallIcon lets Capacitor fall back to the app launcher icon,
          // so we don't depend on a custom drawable being bundled.
          extra: { link: link || '/' },
        },
      ],
    });
  } catch {
    /* ignore — notification is a nicety, not critical path */
  }
}
