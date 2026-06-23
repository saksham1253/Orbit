import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * seenSentStore — tracks outgoing ("Sent") connection requests in a TERMINAL
 * state (accepted / declined) that the user has already viewed once.
 *
 * Behaviour: a resolved sent request is shown ONE time in the Sent tab so the
 * user sees the outcome, then it's filtered out on subsequent views. Pending
 * requests are never tracked here — they always stay until they resolve or are
 * cancelled. Persisted to localStorage so "already seen" survives reloads.
 */
const useSeenSentStore = create(
  persist(
    (set, get) => ({
      seen: {}, // connectionId -> true

      markSeen: (ids) => {
        if (!ids || !ids.length) return;
        const next = { ...get().seen };
        let changed = false;
        for (const id of ids) {
          if (id && !next[id]) { next[id] = true; changed = true; }
        }
        if (changed) set({ seen: next });
      },
    }),
    { name: 'orbit-seen-sent' }
  )
);

export default useSeenSentStore;
