// FrontEnd/src/utils/notifyPermission.js
//
// One cross-platform place to read + request notification permission, so the
// Settings toggle behaves the same whether we're on the web (Notification API)
// or the native APK (Capacitor Local + Push permissions). Everything degrades
// gracefully — a browser without the Notification API reports "unsupported".

import { Capacitor } from '@capacitor/core';
import { requestNotificationPermission as requestWebPermission } from './notifications';

const isNative = () => {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
};

/**
 * Current permission as one of: 'granted' | 'denied' | 'default' | 'unsupported'.
 */
export async function getNotificationPermission() {
  if (isNative()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const p = await LocalNotifications.checkPermissions();
      if (p.display === 'granted') return 'granted';
      if (p.display === 'denied') return 'denied';
      return 'default';
    } catch {
      return 'default';
    }
  }
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission; // 'granted' | 'denied' | 'default'
}

/**
 * Prompt for permission. On native this covers BOTH local notifications (in-app
 * tray entries) and FCM push (killed-app delivery) and (re)registers the push
 * token on success. Returns true if granted.
 */
export async function requestNotificationPermission() {
  if (isNative()) {
    let localGranted = false;
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const p = await LocalNotifications.requestPermissions();
      localGranted = p.display === 'granted';
    } catch { /* ignore */ }
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      const pp = await PushNotifications.requestPermissions();
      if (pp.receive === 'granted') await PushNotifications.register();
    } catch { /* ignore */ }
    return localGranted;
  }
  return requestWebPermission();
}
