/**
 * LiftoffWatcher — fires a rank moment when the logged-in user's cosmic tier
 * genuinely CHANGES versus the last tier we recorded (v4 §4-5):
 *   - UP   → warm "accretion / rising" cinematic (incl. "back to the Moon")
 *   - DOWN → calm "cooling / dimming" descent (encouraging, never shaming),
 *            with the exact points needed to recover.
 * Only on a real, persisted change (after server-side hysteresis) — never a
 * transient recompute. First sighting of a user records silently (no false
 * moment on load).
 *
 * Renders nothing. Mounted once at the app root.
 */
import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useMentorCosmic } from './useCosmic';
import useLiftoffStore from './liftoffStore';
import { TIER_ORDER, TIER_FLOORS } from './tiers';

const idx = (tierId) => TIER_ORDER.indexOf(tierId);

export default function LiftoffWatcher() {
  const user = useAuthStore((s) => s.user);
  const play = useLiftoffStore((s) => s.play);
  const syncTier = useLiftoffStore((s) => s.syncTier);

  const { data } = useMentorCosmic(user?._id, !!user?._id);

  useEffect(() => {
    if (!user?._id || !data?.tierId) return;
    const prev = syncTier(user._id, data.tierId);
    if (!prev || prev === data.tierId) return;     // first sight / no change

    const up = idx(data.tierId) > idx(prev);
    if (up) {
      play(data.tierId, { fromTierId: prev, score: data.score, direction: 'up' });
    } else {
      // Demotion: how many points to climb back to the tier they fell from.
      const recoverFloor = TIER_FLOORS[prev];
      const pointsToRecover = recoverFloor != null && data.score != null
        ? Math.max(0, Math.round((recoverFloor - data.score) * 10) / 10) : null;
      play(data.tierId, { fromTierId: prev, score: data.score, direction: 'down', pointsToRecover });
    }
  }, [user?._id, data?.tierId, data?.score, play, syncTier]);

  return null;
}
