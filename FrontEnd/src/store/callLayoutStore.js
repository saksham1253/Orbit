/**
 * callLayoutStore — persists where the user parked their two in-call video tiles
 * (self + remote PiP) so a hand-tuned layout survives navigation and app restarts.
 *
 * Each tile is `{ x, y, w, h, collapsed, hidden }` in CSS px (top-left origin), or
 * `null` meaning "use the component's default corner". Positions are clamped to the
 * viewport on read (a tile can never persist off-screen after a rotation/resize).
 * `resetLayout()` clears both back to defaults (wired to a "Reset layout" control).
 *
 * Kept intentionally tiny + local (localStorage) — this is a per-device UI
 * preference, never sent to the server. Mirrors the zustand+persist pattern used
 * by store/authStore.js.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useCallLayoutStore = create(
  persist(
    (set) => ({
      self: null,   // { x, y, w, h, collapsed, hidden } | null
      remote: null,

      /** Merge a partial patch into one tile ('self' | 'remote'). */
      setTile: (which, patch) =>
        set((s) => ({ [which]: { ...(s[which] || {}), ...patch } })),

      /** Forget both tiles → each returns to its default corner/size. */
      resetLayout: () => set({ self: null, remote: null }),
    }),
    { name: 'orbit-call-layout' }
  )
);

export default useCallLayoutStore;
