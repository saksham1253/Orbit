/**
 * Orbit Whiteboard — sync transport.
 *
 * Hybrid, lowest-latency-first:
 *   • WebRTC DataChannel on the EXISTING call RTCPeerConnection when available:
 *       - "wb-fast" : unordered + no retransmit → cursors, live strokes, laser
 *       - "wb-safe" : ordered + reliable        → committed ops, snapshots, chat
 *     Channels are `negotiated` (fixed ids) so no renegotiation is needed and
 *     they pair up regardless of which side opens the board first.
 *   • Socket.io relay fallback (server rebroadcasts to the room) whenever a
 *     DataChannel isn't open yet — so it always works, even pre-connection.
 *
 * The engine stays transport-agnostic; this class bridges Board <-> network.
 */

// Cache negotiated channels on the peer connection so re-opening the board
// reuses them instead of colliding on the fixed ids.
function getChannels(pc) {
  if (!pc) return { fast: null, safe: null };
  if (pc.__wbChannels) return pc.__wbChannels;
  try {
    const safe = pc.createDataChannel('wb-safe', { negotiated: true, id: 71, ordered: true });
    const fast = pc.createDataChannel('wb-fast', { negotiated: true, id: 72, ordered: false, maxRetransmits: 0 });
    pc.__wbChannels = { fast, safe };
    return pc.__wbChannels;
  } catch {
    return { fast: null, safe: null };
  }
}

export class WhiteboardSync {
  constructor({ socket, pc, roomId, user, board, handlers = {} }) {
    this.socket = socket;
    this.pc = pc;
    this.roomId = roomId;
    this.user = user;
    this.senderId = user?._id || `guest-${Math.random().toString(36).slice(2, 8)}`;
    this.board = board;
    this.h = handlers; // { onChat, onReaction, onRaiseHand, onPeerJoin, onPeerLeave }

    this._cursorPending = null;
    this._cursorRaf = null;
    this._destroyed = false;
    this._color = pickColor(this.senderId);
    this._onSocket = [];
    // Belt-and-suspenders outbound buffer for COMMITTED ops made before ANY
    // transport is ready (no DataChannel open yet AND socket not connected).
    // Flushed on safe-channel open and on socket connect. Snapshot-on-join
    // already covers late joiners; this closes the brief pre-connect window.
    this._outQueue = [];
  }

  init() {
    const { fast, safe } = getChannels(this.pc);
    this.fast = fast; this.safe = safe;
    if (safe) safe.onmessage = (e) => this._onChannel(e.data);
    if (fast) fast.onmessage = (e) => this._onChannel(e.data);
    if (safe) safe.onopen = () => { this.requestSnapshot(); this._flushOps(); };

    // Flush any buffered committed ops once the socket connects (socket.io also
    // buffers its own emits, but this also lets us re-route through the now-open
    // channel and covers a socket that connects after init).
    this._bind('connect', () => this._flushOps());

    // Socket relays (fallback + always-on membership-gated path).
    this._bind('whiteboard-op', ({ op }) => op && this.board.applyRemoteOp(op));
    this._bind('whiteboard-cursor', ({ data }) => data && this.board.setCursor(data.id, data));
    this._bind('whiteboard-live', ({ userId, stroke }) => this.board.setRemoteLive(userId, stroke));
    this._bind('whiteboard-laser', ({ x, y, color }) => this.board.addLaser(x, y, color));
    this._bind('whiteboard-snapshot-request', ({ from }) => this._sendSnapshot(from));
    this._bind('whiteboard-snapshot', ({ snapshot }) => this.board.mergeSnapshot(snapshot));
    this._bind('whiteboard-chat', ({ msg }) => this.h.onChat && this.h.onChat(msg));
    this._bind('whiteboard-reaction', (p) => this.h.onReaction && this.h.onReaction(p));
    this._bind('whiteboard-raise-hand', (p) => this.h.onRaiseHand && this.h.onRaiseHand(p));
    this._bind('whiteboard-peer-left', ({ userId }) => { this.board.dropPeer(userId); this.h.onPeerLeave && this.h.onPeerLeave(userId); });

    // Announce membership so the server can gate writes + peers can resync.
    this.socket?.emit('whiteboard-join', { roomId: this.roomId, name: this.user?.name });
    // Ask whoever is present for the current board.
    this.requestSnapshot();
  }

  _bind(event, fn) {
    if (!this.socket) return;
    const wrapped = (payload) => { if (!this._destroyed) fn(payload || {}); };
    this.socket.on(event, wrapped);
    this._onSocket.push([event, wrapped]);
  }

  _channelSafeOpen() { return this.safe && this.safe.readyState === 'open'; }
  _channelFastOpen() { return this.fast && this.fast.readyState === 'open'; }

  _onChannel(raw) {
    let m; try { m = JSON.parse(raw); } catch { return; }
    switch (m.k) {
      case 'op': this.board.applyRemoteOp(m.op); break;
      case 'cursor': this.board.setCursor(m.data.id, m.data); break;
      case 'live': this.board.setRemoteLive(m.userId, m.stroke); break;
      case 'laser': this.board.addLaser(m.x, m.y, m.color); break;
      case 'snapshot-req': this._sendSnapshot(); break;
      case 'snapshot': this.board.mergeSnapshot(m.snapshot); break;
      case 'chat': this.h.onChat && this.h.onChat(m.msg); break;
      case 'reaction': this.h.onReaction && this.h.onReaction(m); break;
      case 'hand': this.h.onRaiseHand && this.h.onRaiseHand(m); break;
      default: break;
    }
  }

  // ── Outbound: committed ops (reliable) ────────────────────────────────────
  sendOp(op) {
    if (this._channelSafeOpen()) { try { this.safe.send(JSON.stringify({ k: 'op', op })); return; } catch { /* fall through */ } }
    if (this.socket && this.socket.connected) { this.socket.emit('whiteboard-op', { roomId: this.roomId, op }); return; }
    // No transport ready — buffer (bounded) and flush on open/connect.
    this._outQueue.push(op);
    if (this._outQueue.length > 500) this._outQueue.shift();
  }

  _flushOps() {
    if (!this._outQueue.length) return;
    if (!this._channelSafeOpen() && !(this.socket && this.socket.connected)) return;
    const q = this._outQueue; this._outQueue = [];
    for (const op of q) this.sendOp(op);
  }

  // ── Outbound: ephemeral (unreliable, cursor throttled to rAF) ─────────────
  sendCursor(x, y, tool) {
    this._cursorPending = { id: this.senderId, name: this.user?.name || 'Guest', color: this._color, x, y, tool };
    if (this._cursorRaf) return;
    this._cursorRaf = requestAnimationFrame(() => {
      this._cursorRaf = null;
      const data = this._cursorPending; if (!data) return;
      if (this._channelFastOpen()) { try { this.fast.send(JSON.stringify({ k: 'cursor', data })); return; } catch { /* */ } }
      this.socket?.emit('whiteboard-cursor', { roomId: this.roomId, data });
    });
  }

  sendLiveStroke(stroke) {
    const payload = { k: 'live', userId: this.senderId, stroke };
    if (this._channelFastOpen()) { try { this.fast.send(JSON.stringify(payload)); return; } catch { /* */ } }
    this.socket?.emit('whiteboard-live', { roomId: this.roomId, userId: this.senderId, stroke });
  }

  sendLaser(x, y) {
    if (this._channelFastOpen()) { try { this.fast.send(JSON.stringify({ k: 'laser', x, y, color: this._color })); return; } catch { /* */ } }
    this.socket?.emit('whiteboard-laser', { roomId: this.roomId, x, y, color: this._color });
  }

  // ── Snapshots (late-join / reconnect) ─────────────────────────────────────
  requestSnapshot() {
    if (this._channelSafeOpen()) { try { this.safe.send(JSON.stringify({ k: 'snapshot-req' })); return; } catch { /* */ } }
    this.socket?.emit('whiteboard-snapshot-request', { roomId: this.roomId, from: this.senderId });
  }
  _sendSnapshot() {
    const snapshot = this.board.snapshot();
    if (this._channelSafeOpen()) { try { this.safe.send(JSON.stringify({ k: 'snapshot', snapshot })); return; } catch { /* */ } }
    this.socket?.emit('whiteboard-snapshot', { roomId: this.roomId, snapshot });
  }

  // ── Chat / reactions / raise-hand ─────────────────────────────────────────
  sendChat(text) {
    const msg = { id: `${this.senderId}-${Date.now()}`, from: this.senderId, name: this.user?.name || 'You', text, ts: Date.now() };
    if (this._channelSafeOpen()) { try { this.safe.send(JSON.stringify({ k: 'chat', msg })); } catch { this.socket?.emit('whiteboard-chat', { roomId: this.roomId, msg }); } }
    else this.socket?.emit('whiteboard-chat', { roomId: this.roomId, msg });
    return msg; // echo locally
  }
  sendReaction(emoji) {
    const p = { k: 'reaction', emoji, name: this.user?.name || 'Someone', from: this.senderId };
    if (this._channelFastOpen()) { try { this.fast.send(JSON.stringify(p)); } catch { this.socket?.emit('whiteboard-reaction', { roomId: this.roomId, ...p }); } }
    else this.socket?.emit('whiteboard-reaction', { roomId: this.roomId, ...p });
  }
  sendRaiseHand(state) {
    const p = { k: 'hand', state, name: this.user?.name || 'Someone', from: this.senderId };
    if (this._channelSafeOpen()) { try { this.safe.send(JSON.stringify(p)); } catch { this.socket?.emit('whiteboard-raise-hand', { roomId: this.roomId, ...p }); } }
    else this.socket?.emit('whiteboard-raise-hand', { roomId: this.roomId, ...p });
  }

  destroy() {
    this._destroyed = true;
    if (this._cursorRaf) cancelAnimationFrame(this._cursorRaf);
    for (const [event, fn] of this._onSocket) this.socket?.off(event, fn);
    this._onSocket = [];
    this.socket?.emit('whiteboard-leave', { roomId: this.roomId, userId: this.senderId });
    // Intentionally DO NOT close negotiated channels — reused if the board reopens.
    if (this.safe) this.safe.onmessage = null;
    if (this.fast) this.fast.onmessage = null;
  }

  get color() { return this._color; }
}

// Deterministic bright color per user so cursors are stable across sessions.
function pickColor(seed) {
  let h = 0;
  for (let i = 0; i < String(seed).length; i++) h = (h * 31 + String(seed).charCodeAt(i)) % 360;
  return `hsl(${h} 90% 62%)`;
}
