/**
 * LiftoffWatcher — fires the rank-up overlay when the logged-in user's cosmic
 * tier genuinely INCREASES versus the last tier we recorded for them (spec §8:
 * trigger only on a real, confirmed tier change — never a transient recompute,
 * never a decrease). The first time we ever see a user we just record their
 * tier silently, so existing users don't get a Liftoff on first load.
 *
 * Renders nothing. Mounted once at the app root.
 */
import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useMentorCosmic } from './useCosmic';
import useLiftoffStore from './liftoffStore';
import { TIER_ORDER } from './tiers';

const idx = (tierId) => TIER_ORDER.indexOf(tierId);

export default function LiftoffWatcher() {
  const user = useAuthStore((s) => s.user);
  const play = useLiftoffStore((s) => s.play);
  const syncTier = useLiftoffStore((s) => s.syncTier);

  const { data } = useMentorCosmic(user?._id, !!user?._id);

  useEffect(() => {
    if (!user?._id || !data?.tierId) return;
    const prev = syncTier(user._id, data.tierId);
    // Only celebrate a genuine climb (prev known, strictly higher on the ladder).
    if (prev && prev !== data.tierId && idx(data.tierId) > idx(prev)) {
      play(data.tierId, { fromTierId: prev, score: data.score });
    }
  }, [user?._id, data?.tierId, data?.score, play, syncTier]);

  return null;
}
