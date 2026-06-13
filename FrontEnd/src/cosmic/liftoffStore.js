/**
 * liftoffStore.js — drives the rank-up "Liftoff" overlay.
 *
 * `event` is set when a Liftoff should play; the overlay reads it and clears it
 * when done. `lastSeen` persists each user's last-known tier so the watcher can
 * fire ONLY on a genuine increase (never on a transient recompute) — spec §8.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

let _seq = 0;

const useLiftoffStore = create(
  persist(
    (set, get) => ({
      event: null,                 // { id, fromTierId, toTierId, city, score }
      lastSeen: {},                // userId → tierId (persisted)
      introsSeen: {},              // `${userId}:${tierId}` → true (persisted; v2 §7.1)

      /** Queue a Liftoff. fromTierId may be null for a first-time reveal. */
      play: (toTierId, { fromTierId = null, city = '', score = null } = {}) =>
        set({ event: { id: ++_seq, fromTierId, toTierId, city, score } }),

      clear: () => set({ event: null }),

      /**
       * Mark the one-time intro reveal for a (user, tier) as seen.
       * Returns true if it was ALREADY seen (so the caller skips replaying).
       */
      markIntroSeen: (userId, tierId) => {
        const key = `${userId}:${tierId}`;
        if (get().introsSeen[key]) return true;
        set({ introsSeen: { ...get().introsSeen, [key]: true } });
        return false;
      },

      /**
       * Record the latest tier for a user and return the previously-seen tier
       * (undefined the first time we ever see them — so we don't fire on load).
       */
      syncTier: (userId, tierId) => {
        const prev = get().lastSeen[userId];
        if (prev !== tierId) {
          set({ lastSeen: { ...get().lastSeen, [userId]: tierId } });
        }
        return prev;
      },
    }),
    {
      name: 'skillswap-liftoff',
      partialize: (s) => ({ lastSeen: s.lastSeen, introsSeen: s.introsSeen }), // never persist a pending event
    }
  )
);

export default useLiftoffStore;
