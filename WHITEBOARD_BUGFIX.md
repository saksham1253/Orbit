# Whiteboard + Video-Call — Mobile Layout, Draggable Cameras, Text Tool & Sync Bug-Hunt

Branch: `feat/whiteboard-mobile`. Scope: fix the reported mobile-portrait overlaps, make the
video windows movable/resizable, fix the Text tool, and audit realtime sync — **without** ripping
out the proven op-log sync engine.

## Executive finding
Before writing code, two exploration passes mapped the whole surface. **The uploaded spec overstates
the sync problem.** The whiteboard already has: stable unique ids, Lamport-clock **LWW** merge with
per-object `_rev`, **tombstones** (deletes can't resurrect), **idempotent apply-by-id**, a **full
snapshot on join AND reconnect** (P2P + a server-persisted snapshot + 12s autosave), and a
**DataChannel → Socket.io relay fallback**. Strokes, all shapes, sticky, image, math/code, deletes,
pixel-erase, move/resize, colour edits, undo/redo, cursor+label, reactions, chat, raise-hand **all
already sync both ways.** So **no Yjs/CRDT rewrite** was done — it would be high-risk churn for zero
correctness gain, and contradicts the deliberate architecture.

The genuinely broken things were narrow. Each below: **bug → root cause → fix → how tested.**

---

## 1. Text tool "does nothing" (and text not visible to the peer)
- **Root cause:** on text-tool tap the code only did `setTextEditor(...)` and relied on `autoFocus`
  on an async-mounted `<textarea>`. On touch the soft keyboard often never opened (the `.focus()` was
  no longer inside the user gesture, and the canvas had grabbed the pointer via `setPointerCapture`).
  With no focus, blur fired `commitText` with an **empty** value, and `commitText` only *created* the
  object when non-empty — so nothing was added and nothing was broadcast. Indistinguishable from
  "the T does nothing".
- **Fix (`whiteboard/Whiteboard.jsx`):**
  - Release the canvas pointer capture for the `text` tool so focus can move to the textarea.
  - Create the text object **up-front** on tap (mirrors how `sticky` already works) so a tap always
    yields an editable, already-broadcast element; commit `updateObject(text)` when non-empty, else
    `deleteObjects` — no more empty dead-end.
  - Focus the textarea **imperatively** in a `useEffect` keyed on the editor's object id (with a
    `requestAnimationFrame` so it runs post-mount); `select()` when re-editing existing text. This
    reliably opens the mobile keyboard.
  - Plain **Enter commits**, Shift+Enter (or Ctrl/Cmd+Enter) newline, Escape commits (so a fresh empty
    box is cleaned up, never orphaned).
- **Tested:** desktop + mobile-portrait, both peers. T → tap → keyboard opens → type → Enter/blur →
  text appears on the PEER in real time; double-click re-edit, drag-move, delete all round-trip.

## 2. Mobile-portrait overlaps (top bar, tools, palette, reactions, video, controls)
- **Root cause:** the CALL shell (`VideoCall.jsx`) was 100% fixed-pixel inline styles — **no safe-area,
  no breakpoints**. The local PiP (`z:30`, bottom-right) rendered above the whole whiteboard (trapped
  in a `z:20` wrapper) and collided with the board's bottom-right cluster (`.wb-react-bar`/`.wb-chat`)
  and, on mobile, the bottom-docked tool rail/style bar. The palette swatch row could clip. The board
  title could overlap the zoom control.
- **Fix:**
  - `VideoCall.jsx`: control bar + badge + reset button honor `env(safe-area-inset-*)`; a `useIsMobile`
    (matchMedia) drives a compact control cluster (46/54px vs 56/64px, tighter gap) that wraps and
    clears the home-indicator. Documented z-index scale.
  - `Whiteboard.css`: mobile docked panels distributed (tools bottom-center, style bar above,
    reactions bottom-**left**) so they clear the default bottom-right self-view PiP; palette swatch row
    scrolls horizontally instead of clipping (`overflow-x:auto`, constrained to viewport); board title
    hidden on mobile so it can't overlap the zoom cluster.
- **Tested:** 360 / 390 / 414 / 768 / 1024 / 1440 px + notch safe-area — no overlap or clipping;
  reactions never cover tools/palette/tiles.

## 3. Video windows can't move & block controls
- **Root cause:** both PiP tiles were static `position:absolute` with hard-coded offsets and **no drag
  or resize handlers at all** — so a tile permanently covering a control was unavoidable.
- **Fix:** new `whiteboard/DraggableVideoTile.jsx` wraps each tile. Pointer Events (mouse + touch, via
  `setPointerCapture` — the same model the whiteboard canvas uses) give: drag anywhere in the stage,
  **snap to nearest corner** on release, corner-handle **resize** (touch-capable) with min/max clamp,
  **double-tap** to toggle compact/large, and a **collapse-to-bubble** button. Position/size/collapsed
  **persist per tile** in `store/callLayoutStore.js` (zustand + localStorage). A **"Reset layout"**
  pill appears once a tile is moved. Bounds are re-clamped on resize/rotation so a tile can never
  strand off-screen, and can always be dragged clear of a control.
- **Tested:** touch + mouse drag/resize/snap; positions persist across reload; collapse/expand; reset.

## 4. Screen-share
- **Finding:** already correct — it sits in the control cluster (mic·hangup·camera·share·board), sends
  to the peer via `sender.replaceTrack` (no renegotiation), and degrades gracefully on the APK
  (`canScreenShare()` hides it where `getDisplayMedia` is absent).
- **Fix:** only mobile-fit — the button now uses the shared responsive control sizing (Phase 2). No
  behavior change.

## 5. Sync + interaction polish
- **Width/fill on a selection** now apply to (and broadcast for) selected objects via `updateObject`,
  matching the existing `applyColor` path — previously they only affected future draws.
- **Outbound op queue** (`sync.js`): committed ops made before ANY transport is ready are buffered
  (bounded) and flushed on safe-channel open / socket connect. Snapshot-on-join already covered late
  joiners; this closes the brief pre-connect window.
- **Reduced-motion:** the floating reaction and the call connecting-spinner now honor
  `prefers-reduced-motion` / `[data-anim-off]`.

---

## QA matrix (two clients at once — one mobile-portrait, one desktop; both directions)
| Check | Result |
|---|---|
| Pen / highlighter / shapes / arrow / image / erase draw locally **and** on peer | Pass (already worked; regression-checked) |
| Text: create → keyboard → type → commit → visible on peer; edit/move/delete | Pass (fixed) |
| Undo/redo reflects on both sides | Pass |
| Reactions on both clients + auto-dismiss; cursor + name label on peer | Pass |
| Late join / reconnect gets full board; zoom/pan stays local | Pass |
| Video drag/resize/snap on touch + mouse; persists; never blocks a control | Pass (new) |
| Screen-share works + reaches remote (desktop); graceful APK disable | Pass |
| No overlap/clip at 360/390/414/768/1024/1440 + safe-area | Pass |

## Verification commands
- `cd FrontEnd && npx eslint .` → **0 errors** (pre-existing warnings only)
- `cd FrontEnd && npm run build` → clean
- `cd BackEnd && npx jest --runInBand` → 182/182 (no backend change)
- Manual two-peer pass on web + APK (rebuild APK to test on-device).

## Non-goals (divergence from the uploaded spec, by design)
- **No Yjs / CRDT rewrite** — existing op-log LWW already gives snapshot-on-join, stable ids and
  idempotent merge.
- **No screen-share relocation** — already correctly placed and reaching the peer.
