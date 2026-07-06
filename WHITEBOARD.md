# Orbit Whiteboard — Architecture & Operations

A **100% Orbit-owned**, hand-built collaborative whiteboard that lives inside the existing
1:1 video call. No third-party canvas library (no tldraw / Excalidraw / Konva / Fabric) and no
CRDT library (no Yjs). No Jitsi — the call is already custom WebRTC.

## Why this shape (context)

- The video call was **already custom WebRTC + Socket.io** (`DirectVideoCall` in
  `FrontEnd/src/pages/VideoCall.jsx`). There was never a real Jitsi integration, so we build the
  board on the existing peer connection instead of adding an iframe.
- The Cloudflare Worker (`BackEnd/worker.js`) **rejects WebSocket upgrades** and there are **no
  Durable Objects**, so a Yjs-on-DO backbone doesn't fit. Socket.io is anchored to one always-on
  host (Railway/Oracle).
- Calls are **1:1**, so a full CRDT is overkill. We use a small **op-log with Lamport-clock,
  last-writer-wins** convergence.

## Zero-latency design

- **Local-first / optimistic:** the local user's ink renders immediately; sync is background.
- **Two-layer canvas** (`board.js`): a *base* layer (committed objects, redrawn on change) and a
  *live* layer (in-progress strokes, remote cursors, laser) repainted each `requestAnimationFrame`.
- **Hybrid transport** (`sync.js`), lowest-latency first:
  - **WebRTC DataChannel** on the existing call `RTCPeerConnection` — `negotiated` channels (fixed
    ids 71/72) so no renegotiation:
    - `wb-fast` — unordered, `maxRetransmits: 0` → cursors, in-progress strokes, laser.
    - `wb-safe` — ordered, reliable → committed ops, snapshots, chat.
  - **Socket.io relay fallback** — server rebroadcasts to the room whenever a channel isn't open
    (works even before the peer connection is up).
- **Coalescing:** cursors are throttled to `rAF`; live strokes are sent at most every ~45 ms.
- Targets: <50 ms perceived local latency, <150 ms remote echo.

## Convergence (no CRDT)

Every op carries `{ senderId, seq }` (Lamport clock, merged on receive). Ops are idempotent;
conflicting edits to one object resolve LWW by `(seq, senderId)`. **Tombstones are version-aware**
(`id → delete-seq`) so a genuinely newer re-add (undo-of-delete / redo-of-add) resurrects an object
while a *stale* late add stays deleted. See `board.js#_apply`.

## Where the button lives

`FrontEnd/src/pages/VideoCall.jsx`, `DirectVideoCall` control bar — a 4th circular **PenTool**
button (plus a **MonitorUp** screen-share button) next to mic / hang-up / camera. Toggling it mounts
the lazy-loaded `<Whiteboard>` overlay (board-focus) with video shrunk to draggable PiPs.

## How `sessionId` links video + board

The whiteboard `roomId` **is** the call room id (a connection `_id` or the deterministic
`generateRoomName`). The same id keys: the Socket.io room, the `whiteboard-*` relays, the P2P
channels, and the persisted `Whiteboard` document — so the board a pair drew on is always the same
board, and it reopens from call history.

## Files

**Frontend (`FrontEnd/src/whiteboard/`)**
- `constants.js` — tools, palette, op types, limits.
- `objects.js` — geometry: Catmull-Rom smoothing, per-object draw, hit-testing, bbox, Shift-constrain.
- `board.js` — engine: op-log, Lamport LWW, undo/redo, two-layer render, pixel/object erase,
  templates, PNG/SVG export, snapshot/merge.
- `sync.js` — DataChannel + Socket.io transport, cursor throttling, snapshots, chat/reactions/hand.
- `richText.js` — native math (`^`/`_`) and code (line numbers + token coloring) rendered to canvas.
- `Whiteboard.jsx` / `Whiteboard.css` — React UI: pointer state machine, toolbar, panels, themed
  with the app's cosmic CSS variables.
- `__tests__/board.test.js` — convergence, LWW, undo/redo, pixel-erase, geometry, snapshot.

**Backend**
- `models/whiteboard.js` — persisted snapshot keyed by `roomName`, with `participants`.
- `routes/whiteboardRoutes.js` — `GET/PUT /api/whiteboard/:roomName`, membership-gated.
- `utils/roomMembership.js` — `verifyRoomMember(userId, roomName)` via `CallHistory` / `Connection`.
- `server.js` — `whiteboard-*` socket relays + a **membership gate**: a socket must prove (via its
  JWT `userId`) it's a participant before the server relays its ops (fail-closed; P2P is unaffected).
  The call socket now sends the JWT so `socket.userId` is set.

## Features

Pen, highlighter, object + pixel eraser (adjustable), all shapes (rect / square / circle-ellipse /
line / arrow / triangle / diamond / rounded, Shift-constrain), text, sticky notes, image paste/upload,
laser, select / move / resize, undo/redo, zoom/pan, clear, **export PNG / SVG / PDF**. Multi-page with
templates (grid / dots / axes / staff / flow). Live named cursors, in-call chat, reactions + raise-hand,
screen share. Board **persists** and **reopens** from call history ("Board" button).

## Running

Nothing extra to run — the sync server *is* the existing Socket.io backend and the REST routes are
mounted under `/api/whiteboard`. Dev: `npm run dev` (frontend) + `node server.js` (backend). The Vite
proxy already forwards `/api` and `/socket.io`.

## Security

- Socket whiteboard writes and REST read/write are **membership-gated** (participants only).
- Pasted images are downscaled/re-encoded and size-capped (~3 MB); snapshot save capped server-side.
- Same-origin CORS (unchanged). Multi-host note: whiteboard socket events, like all sockets, need the
  Redis adapter only if >1 host ever serves sockets; today it's single-host in-memory.

## APK / web parity

Pointer Events + `touch-action: none` (finger + stylus); responsive toolbar; large touch targets. The
board ships in the same `dist/` as the web build. Verify on **both** the website and the Android APK.
