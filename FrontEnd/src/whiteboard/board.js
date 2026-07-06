/**
 * Orbit Whiteboard — Board engine (framework-agnostic).
 *
 * Owns the scene (objects + pages + viewport), a two-layer canvas render loop,
 * an idempotent op-log with Lamport-clock last-writer-wins convergence, local
 * undo/redo, pixel/object erasing, templates, and PNG/SVG export.
 *
 * The engine never talks to the network directly. It calls `onLocalOp(op)` when
 * a local action produces an op to broadcast, and `onChange()` when UI-visible
 * state (pages, selection, undo availability) changes. Remote ops arrive via
 * `applyRemoteOp(op)`.
 */
import { OP, LIMITS, TEMPLATES } from './constants';
import { drawObject, bbox, hitTest, roundRect } from './objects';

export class Board {
  constructor({ senderId, onLocalOp, onChange }) {
    this.senderId = senderId;
    this.onLocalOp = onLocalOp || (() => {});
    this.onChange = onChange || (() => {});

    this.objects = new Map();          // id -> object (with _rev {seq,sid})
    this.tombstones = new Map();       // id -> delete seq (version-aware: a newer re-add resurrects)
    this.images = new Map();           // id -> HTMLImageElement (image/math/code)
    this.pages = [{ id: 'p0', template: 'blank' }];
    this.pageIndex = 0;

    this.clock = 0;                    // Lamport clock for LWW ordering
    this.undoStack = [];
    this.redoStack = [];

    this.viewport = { scale: 1, x: 0, y: 0 };
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Ephemeral (never persisted): live strokes, cursors, lasers.
    this.localLive = null;             // in-progress local stroke
    this.remoteLive = new Map();       // userId -> stroke
    this.cursors = new Map();          // userId -> {x,y,name,color,tool,ts}
    this.lasers = [];                  // {x,y,color,ts}
    this.selection = new Set();

    this._baseCtx = null; this._liveCtx = null;
    this._baseCanvas = null; this._liveCanvas = null;
    this._css = { w: 0, h: 0 };
    this._dirtyBase = true;
    this._raf = null;
    this._running = false;
  }

  // ── Canvas wiring ─────────────────────────────────────────────────────────
  attach(baseCanvas, liveCanvas) {
    this._baseCanvas = baseCanvas; this._liveCanvas = liveCanvas;
    this._baseCtx = baseCanvas.getContext('2d');
    this._liveCtx = liveCanvas.getContext('2d');
    this.resize();
    this._running = true;
    this._loop();
  }

  detach() {
    this._running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
  }

  resize() {
    if (!this._baseCanvas) return;
    const rect = this._baseCanvas.getBoundingClientRect();
    this._css = { w: rect.width, h: rect.height };
    for (const c of [this._baseCanvas, this._liveCanvas]) {
      c.width = Math.max(1, Math.round(rect.width * this.dpr));
      c.height = Math.max(1, Math.round(rect.height * this.dpr));
    }
    this._dirtyBase = true;
  }

  // ── Coordinate transforms ─────────────────────────────────────────────────
  toWorld(cssX, cssY) {
    return { x: (cssX - this.viewport.x) / this.viewport.scale, y: (cssY - this.viewport.y) / this.viewport.scale };
  }

  _applyTransform(ctx) {
    const { scale, x, y } = this.viewport;
    ctx.setTransform(this.dpr * scale, 0, 0, this.dpr * scale, this.dpr * x, this.dpr * y);
  }

  panBy(dx, dy) { this.viewport.x += dx; this.viewport.y += dy; this._dirtyBase = true; }
  zoomAt(cssX, cssY, factor) {
    const w = this.toWorld(cssX, cssY);
    this.viewport.scale = Math.max(0.15, Math.min(6, this.viewport.scale * factor));
    // keep the point under the cursor stationary
    this.viewport.x = cssX - w.x * this.viewport.scale;
    this.viewport.y = cssY - w.y * this.viewport.scale;
    this._dirtyBase = true;
    this.onChange();
  }
  resetView() { this.viewport = { scale: 1, x: 0, y: 0 }; this._dirtyBase = true; this.onChange(); }

  // ── Render loop ───────────────────────────────────────────────────────────
  markDirty() { this._dirtyBase = true; }

  _loop = () => {
    if (!this._running) return;
    if (this._dirtyBase) { this._renderBase(); this._dirtyBase = false; }
    this._renderLive();
    this._raf = requestAnimationFrame(this._loop);
  };

  _renderBase() {
    const ctx = this._baseCtx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this._baseCanvas.width, this._baseCanvas.height);
    this._applyTransform(ctx);
    this._drawTemplate(ctx);
    const page = this.pages[this.pageIndex]?.id;
    for (const obj of this.objects.values()) {
      if (obj.page !== page) continue;
      drawObject(ctx, obj, this.images);
    }
  }

  _renderLive() {
    const ctx = this._liveCtx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this._liveCanvas.width, this._liveCanvas.height);
    this._applyTransform(ctx);

    // in-progress strokes (local + remote)
    if (this.localLive) drawObject(ctx, this.localLive, this.images);
    for (const s of this.remoteLive.values()) if (s) drawObject(ctx, s, this.images);

    // selection outline + handles
    if (this.selection.size) {
      ctx.strokeStyle = '#00c6ff'; ctx.lineWidth = 1.5 / this.viewport.scale;
      ctx.setLineDash([6 / this.viewport.scale, 4 / this.viewport.scale]);
      for (const id of this.selection) {
        const o = this.objects.get(id); if (!o) continue;
        const b = bbox(o);
        ctx.strokeRect(b.x, b.y, b.w, b.h);
      }
      ctx.setLineDash([]);
    }

    // lasers (fade over 900ms)
    const now = performance.now();
    this.lasers = this.lasers.filter((l) => now - l.ts < 900);
    for (const l of this.lasers) {
      const a = 1 - (now - l.ts) / 900;
      ctx.globalAlpha = a; ctx.fillStyle = l.color;
      ctx.beginPath(); ctx.arc(l.x, l.y, 6 / this.viewport.scale, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // remote cursors (name tags drawn in screen space)
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    for (const c of this.cursors.values()) {
      const sx = c.x * this.viewport.scale + this.viewport.x;
      const sy = c.y * this.viewport.scale + this.viewport.y;
      ctx.fillStyle = c.color;
      ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI * 2); ctx.fill();
      ctx.font = '600 12px "Open Sans", sans-serif';
      const label = c.name || 'Guest';
      const w = ctx.measureText(label).width + 12;
      ctx.globalAlpha = 0.9;
      roundRect(ctx, sx + 10, sy - 8, w, 18, 9); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff';
      ctx.fillText(label, sx + 16, sy + 5);
    }
  }

  _drawTemplate(ctx) {
    const tpl = this.pages[this.pageIndex]?.template || 'blank';
    if (tpl === 'blank') return;
    // Visible world rect.
    const tl = this.toWorld(0, 0), br = this.toWorld(this._css.w, this._css.h);
    const step = 32;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 1 / this.viewport.scale;
    const x0 = Math.floor(tl.x / step) * step, y0 = Math.floor(tl.y / step) * step;
    if (tpl === 'grid') {
      ctx.beginPath();
      for (let x = x0; x < br.x; x += step) { ctx.moveTo(x, tl.y); ctx.lineTo(x, br.y); }
      for (let y = y0; y < br.y; y += step) { ctx.moveTo(tl.x, y); ctx.lineTo(br.x, y); }
      ctx.stroke();
    } else if (tpl === 'dots') {
      for (let x = x0; x < br.x; x += step)
        for (let y = y0; y < br.y; y += step) { ctx.beginPath(); ctx.arc(x, y, 1.4 / this.viewport.scale, 0, Math.PI * 2); ctx.fill(); }
    } else if (tpl === 'axes') {
      ctx.strokeStyle = 'rgba(0,198,255,0.35)'; ctx.lineWidth = 1.5 / this.viewport.scale;
      ctx.beginPath(); ctx.moveTo(tl.x, 0); ctx.lineTo(br.x, 0); ctx.moveTo(0, tl.y); ctx.lineTo(0, br.y); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1 / this.viewport.scale;
      ctx.beginPath();
      for (let x = x0; x < br.x; x += step) { ctx.moveTo(x, tl.y); ctx.lineTo(x, br.y); }
      for (let y = y0; y < br.y; y += step) { ctx.moveTo(tl.x, y); ctx.lineTo(br.x, y); }
      ctx.stroke();
    } else if (tpl === 'staff') {
      ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1 / this.viewport.scale;
      const group = 120, lh = 12;
      for (let gy = Math.floor(tl.y / group) * group; gy < br.y; gy += group) {
        for (let i = 0; i < 5; i++) { const y = gy + i * lh; ctx.beginPath(); ctx.moveTo(tl.x, y); ctx.lineTo(br.x, y); ctx.stroke(); }
      }
    } else if (tpl === 'flow') {
      // faint large grid for flowcharts
      const big = 96;
      ctx.beginPath();
      for (let x = Math.floor(tl.x / big) * big; x < br.x; x += big) { ctx.moveTo(x, tl.y); ctx.lineTo(x, br.y); }
      for (let y = Math.floor(tl.y / big) * big; y < br.y; y += big) { ctx.moveTo(tl.x, y); ctx.lineTo(br.x, y); }
      ctx.stroke();
    }
    ctx.restore();
  }

  // ── Op-log core ───────────────────────────────────────────────────────────
  _nextSeq() { return ++this.clock; }
  _stamp(op) { return { ...op, senderId: this.senderId, seq: this._nextSeq() }; }
  _newer(op, rev) { return !rev || op.seq > rev.seq || (op.seq === rev.seq && op.senderId > rev.sid); }

  /** Apply an op to local state (no network). Used for local, remote, undo/redo. */
  _apply(op) {
    if (op.seq > this.clock) this.clock = op.seq; // Lamport merge
    const rev = { seq: op.seq, sid: op.senderId };
    switch (op.t) {
      case OP.ADD: {
        const tomb = this.tombstones.get(op.obj.id);
        if (tomb != null && op.seq <= tomb) break; // an equal/newer delete wins
        const ex = this.objects.get(op.obj.id);
        if (ex && !this._newer(op, ex._rev)) break;
        const obj = { ...op.obj, _rev: rev };
        this.objects.set(obj.id, obj);
        this.tombstones.delete(obj.id); // resurrected → clear tombstone
        this._ensureImage(obj);
        this._dirtyBase = true;
        break;
      }
      case OP.UPDATE: {
        const o = this.objects.get(op.id);
        if (!o || !this._newer(op, o._rev)) break;
        Object.assign(o, op.patch); o._rev = rev;
        if (op.patch && op.patch.src) this._ensureImage(o, true);
        this._dirtyBase = true;
        break;
      }
      case OP.DELETE: {
        this.objects.delete(op.id); this.images.delete(op.id);
        this.tombstones.set(op.id, op.seq); this.selection.delete(op.id);
        this._dirtyBase = true;
        break;
      }
      case OP.CLEAR: {
        for (const [id, o] of this.objects) if (o.page === op.page) { this.objects.delete(id); this.images.delete(id); this.tombstones.set(id, op.seq); }
        this.selection.clear();
        this._dirtyBase = true;
        break;
      }
      case OP.PAGE_ADD: {
        if (!this.pages.find((p) => p.id === op.page.id)) this.pages.push(op.page);
        this._dirtyBase = true; break;
      }
      case OP.PAGE_DEL: {
        this.pages = this.pages.filter((p) => p.id !== op.pageId);
        if (this.pages.length === 0) this.pages = [{ id: 'p0', template: 'blank' }];
        if (this.pageIndex >= this.pages.length) this.pageIndex = this.pages.length - 1;
        this._dirtyBase = true; break;
      }
      case OP.PAGE_TPL: {
        const pg = this.pages.find((p) => p.id === op.pageId);
        if (pg) pg.template = op.template;
        this._dirtyBase = true; break;
      }
      default: break;
    }
  }

  applyRemoteOp(op) { this._apply(op); this.onChange(); }

  /** Commit local forward ops + their inverses (one undo unit). */
  _commit(forwards, inverses) {
    for (const f of forwards) { this._apply(f); this.onLocalOp(f); }
    this.undoStack.push({ forwards, inverses });
    if (this.undoStack.length > 200) this.undoStack.shift();
    this.redoStack = [];
    this.onChange();
  }

  undo() {
    const e = this.undoStack.pop(); if (!e) return;
    // apply inverses in reverse order with fresh stamps so peers converge
    const applied = [];
    for (let i = e.inverses.length - 1; i >= 0; i--) {
      const inv = this._stamp(e.inverses[i]); this._apply(inv); this.onLocalOp(inv); applied.push(inv);
    }
    this.redoStack.push(e);
    this.onChange();
  }
  redo() {
    const e = this.redoStack.pop(); if (!e) return;
    for (const f of e.forwards) { const nf = this._stamp(f); this._apply(nf); this.onLocalOp(nf); }
    this.undoStack.push(e);
    this.onChange();
  }
  canUndo() { return this.undoStack.length > 0; }
  canRedo() { return this.redoStack.length > 0; }

  // ── Public mutations (build forward + inverse) ────────────────────────────
  addObject(obj) {
    if (this.objects.size >= LIMITS.maxObjects) return null;
    obj.page = this.pages[this.pageIndex].id;
    const add = this._stamp({ t: OP.ADD, obj });
    this._commit([add], [{ t: OP.DELETE, id: obj.id }]);
    return obj;
  }

  updateObject(id, patch) {
    const o = this.objects.get(id); if (!o) return;
    const prev = {}; for (const k of Object.keys(patch)) prev[k] = o[k];
    const up = this._stamp({ t: OP.UPDATE, id, patch });
    this._commit([up], [{ t: OP.UPDATE, id, patch: prev }]);
  }

  // Move/resize during a drag: apply live without recording, commit once at end.
  liveUpdate(id, patch) { const o = this.objects.get(id); if (o) { Object.assign(o, patch); this._dirtyBase = true; } }
  commitUpdate(id, patch, prevPatch) {
    const up = this._stamp({ t: OP.UPDATE, id, patch });
    this._apply(up); this.onLocalOp(up);
    this.undoStack.push({ forwards: [up], inverses: [{ t: OP.UPDATE, id, patch: prevPatch }] });
    this.redoStack = []; this.onChange();
  }

  deleteObjects(ids) {
    const forwards = [], inverses = [];
    for (const id of ids) {
      const o = this.objects.get(id); if (!o) continue;
      forwards.push(this._stamp({ t: OP.DELETE, id }));
      const clean = { ...o }; delete clean._rev;
      inverses.push({ t: OP.ADD, obj: clean });
    }
    if (forwards.length) this._commit(forwards, inverses);
  }

  clearPage() {
    const page = this.pages[this.pageIndex].id;
    const inverses = [];
    for (const o of this.objects.values()) if (o.page === page) { const c = { ...o }; delete c._rev; inverses.push({ t: OP.ADD, obj: c }); }
    this._commit([this._stamp({ t: OP.CLEAR, page })], inverses);
  }

  // ── Erasers ───────────────────────────────────────────────────────────────
  objectEraseAt(pt, tol) {
    for (const o of [...this.objects.values()].reverse()) {
      if (o.page !== this.pages[this.pageIndex].id) continue;
      if (hitTest(o, pt, tol)) { this.deleteObjects([o.id]); return; }
    }
  }

  /** Split strokes around a pixel-eraser path (committed at pointer-up). */
  pixelErase(eraserPts, size) {
    const page = this.pages[this.pageIndex].id;
    const forwards = [], inverses = [];
    const hit = (p) => eraserPts.some((e) => Math.hypot(e.x - p.x, e.y - p.y) <= size);
    for (const o of this.objects.values()) {
      if (o.type !== 'stroke' || o.page !== page) continue;
      if (!o.points.some(hit)) continue;
      // Build surviving runs.
      const runs = []; let cur = [];
      for (const p of o.points) {
        if (hit(p)) { if (cur.length > 1) runs.push(cur); cur = []; }
        else cur.push(p);
      }
      if (cur.length > 1) runs.push(cur);
      forwards.push(this._stamp({ t: OP.DELETE, id: o.id }));
      const clean = { ...o }; delete clean._rev; inverses.push({ t: OP.ADD, obj: clean });
      for (const run of runs) {
        const piece = { ...o, id: `${o.id}~${forwards.length}-${runs.indexOf(run)}`, points: run };
        delete piece._rev;
        forwards.push(this._stamp({ t: OP.ADD, obj: piece }));
        inverses.push({ t: OP.DELETE, id: piece.id });
      }
    }
    if (forwards.length) this._commit(forwards, inverses);
  }

  // ── Selection / hit ───────────────────────────────────────────────────────
  hitObject(pt, tol = 8) {
    for (const o of [...this.objects.values()].reverse()) {
      if (o.page !== this.pages[this.pageIndex].id) continue;
      if (hitTest(o, pt, tol)) return o;
    }
    return null;
  }
  setSelection(ids) { this.selection = new Set(ids); this.onChange(); }
  clearSelection() { if (this.selection.size) { this.selection.clear(); this.onChange(); } }

  // ── Pages ─────────────────────────────────────────────────────────────────
  addPage(template = 'blank') {
    if (this.pages.length >= LIMITS.maxPages) return;
    const page = { id: `p${Date.now().toString(36)}-${Math.floor(this.clock)}`, template };
    this._commit([this._stamp({ t: OP.PAGE_ADD, page })], [{ t: OP.PAGE_DEL, pageId: page.id }]);
    this.pageIndex = this.pages.findIndex((p) => p.id === page.id);
    this.onChange();
  }
  deletePage(pageId) {
    const pg = this.pages.find((p) => p.id === pageId); if (!pg || this.pages.length <= 1) return;
    this._commit([this._stamp({ t: OP.PAGE_DEL, pageId })], [{ t: OP.PAGE_ADD, page: pg }]);
    this.onChange();
  }
  setTemplate(template) {
    const pg = this.pages[this.pageIndex]; if (!pg) return;
    this._commit([this._stamp({ t: OP.PAGE_TPL, pageId: pg.id, template })], [{ t: OP.PAGE_TPL, pageId: pg.id, template: pg.template }]);
  }
  setPage(i) { if (i >= 0 && i < this.pages.length) { this.pageIndex = i; this.clearSelection(); this._dirtyBase = true; this.onChange(); } }

  // ── Ephemeral setters ─────────────────────────────────────────────────────
  setLocalLive(stroke) { this.localLive = stroke; }
  setRemoteLive(userId, stroke) { if (stroke) this.remoteLive.set(userId, stroke); else this.remoteLive.delete(userId); }
  setCursor(userId, data) { if (data) this.cursors.set(userId, { ...data, ts: performance.now() }); else this.cursors.delete(userId); }
  addLaser(x, y, color) { this.lasers.push({ x, y, color, ts: performance.now() }); }
  dropPeer(userId) { this.remoteLive.delete(userId); this.cursors.delete(userId); }

  // ── Images ────────────────────────────────────────────────────────────────
  _ensureImage(obj, force = false) {
    if (!['image', 'math', 'code'].includes(obj.type) || !obj.src) return;
    if (this.images.has(obj.id) && !force) return;
    const img = new Image();
    img.onload = () => { this._dirtyBase = true; };
    img.src = obj.src;
    this.images.set(obj.id, img);
  }

  // ── Snapshot (persistence / late-join) ────────────────────────────────────
  snapshot() {
    const objs = [];
    for (const o of this.objects.values()) { const c = { ...o }; c._rev = o._rev; objs.push(c); }
    return { v: 1, pages: this.pages, objects: objs, clock: this.clock };
  }
  loadSnapshot(snap) {
    if (!snap) return;
    this.pages = snap.pages?.length ? snap.pages : this.pages;
    this.objects.clear(); this.images.clear();
    for (const o of snap.objects || []) { this.objects.set(o.id, o); this._ensureImage(o); }
    this.clock = Math.max(this.clock, snap.clock || 0);
    if (this.pageIndex >= this.pages.length) this.pageIndex = 0;
    this._dirtyBase = true; this.onChange();
  }
  // Merge a peer snapshot without clobbering local edits (LWW per object).
  mergeSnapshot(snap) {
    if (!snap) return;
    for (const o of snap.objects || []) {
      const tomb = this.tombstones.get(o.id);
      if (tomb != null && (!o._rev || o._rev.seq <= tomb)) continue; // locally deleted more recently
      const ex = this.objects.get(o.id);
      if (!ex || (o._rev && this._newer({ seq: o._rev.seq, senderId: o._rev.sid }, ex._rev))) {
        this.objects.set(o.id, o); this._ensureImage(o, true);
      }
    }
    for (const p of snap.pages || []) if (!this.pages.find((x) => x.id === p.id)) this.pages.push(p);
    this.clock = Math.max(this.clock, snap.clock || 0);
    this._dirtyBase = true; this.onChange();
  }

  // ── Export ────────────────────────────────────────────────────────────────
  _contentBounds(page) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const o of this.objects.values()) {
      if (o.page !== page) continue;
      const b = bbox(o);
      minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h);
    }
    if (minX === Infinity) return { x: 0, y: 0, w: 1280, h: 720 };
    const pad = 40;
    return { x: minX - pad, y: minY - pad, w: (maxX - minX) + pad * 2, h: (maxY - minY) + pad * 2 };
  }

  toPNG(scale = 2) {
    const page = this.pages[this.pageIndex].id;
    const b = this._contentBounds(page);
    const cv = document.createElement('canvas');
    cv.width = Math.round(b.w * scale); cv.height = Math.round(b.h * scale);
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#0b0a20'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.setTransform(scale, 0, 0, scale, -b.x * scale, -b.y * scale);
    for (const o of this.objects.values()) if (o.page === page) drawObject(ctx, o, this.images);
    return cv.toDataURL('image/png');
  }

  toSVG() {
    const page = this.pages[this.pageIndex].id;
    const b = this._contentBounds(page);
    const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(b.w)}" height="${Math.round(b.h)}" viewBox="${b.x} ${b.y} ${b.w} ${b.h}"><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="#0b0a20"/>`];
    for (const o of this.objects.values()) { if (o.page === page) parts.push(objectToSVG(o)); }
    parts.push('</svg>');
    return parts.join('');
  }
}

// Minimal per-object SVG serialization (native, no libs).
function objectToSVG(o) {
  const esc = (s) => String(s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
  if (o.type === 'stroke') {
    const d = o.points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const op = o.tool === 'highlighter' ? 0.35 : 1;
    return `<path d="${d}" fill="none" stroke="${o.color}" stroke-width="${o.width}" stroke-linecap="round" stroke-linejoin="round" opacity="${op}"/>`;
  }
  if (o.type === 'shape') {
    const x = Math.min(o.x0, o.x1), y = Math.min(o.y0, o.y1), w = Math.abs(o.x1 - o.x0), h = Math.abs(o.y1 - o.y0);
    const fill = o.fill && o.fill !== 'transparent' ? o.fill : 'none';
    const common = `fill="${fill}" stroke="${o.color}" stroke-width="${o.width}"`;
    if (o.shape === 'rect' || o.shape === 'rounded') return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.shape === 'rounded' ? 18 : 0}" ${common}/>`;
    if (o.shape === 'ellipse') return `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" ${common}/>`;
    if (o.shape === 'triangle') return `<polygon points="${x + w / 2},${y} ${x + w},${y + h} ${x},${y + h}" ${common}/>`;
    if (o.shape === 'diamond') return `<polygon points="${x + w / 2},${y} ${x + w},${y + h / 2} ${x + w / 2},${y + h} ${x},${y + h / 2}" ${common}/>`;
    return `<line x1="${o.x0}" y1="${o.y0}" x2="${o.x1}" y2="${o.y1}" stroke="${o.color}" stroke-width="${o.width}"/>`;
  }
  if (o.type === 'text') return `<text x="${o.x}" y="${o.y + (o.size || 22)}" fill="${o.color}" font-size="${o.size}" font-family="Open Sans, sans-serif">${esc(o.text)}</text>`;
  if (o.type === 'sticky') return `<g><rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" rx="8" fill="${o.color}"/><text x="${o.x + 12}" y="${o.y + 28}" fill="#1a1a2e" font-size="15" font-family="Open Sans, sans-serif">${esc(o.text)}</text></g>`;
  if (['image', 'math', 'code'].includes(o.type)) return `<image x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" href="${o.src}"/>`;
  return '';
}

export { TEMPLATES };
