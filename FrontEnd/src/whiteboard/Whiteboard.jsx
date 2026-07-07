import { useEffect, useRef, useState } from 'react';
import * as Lucide from 'lucide-react';
import { Board } from './board';
import { WhiteboardSync } from './sync';
import { TOOLS, SHAPE_TOOLS, PALETTE, STICKY_COLORS, DEFAULTS, TEMPLATES, LIMITS, nextLocalId } from './constants';
import { constrainShape, bbox } from './objects';
import { renderMath, renderCode } from './richText';
import './Whiteboard.css';

// Version-safe lucide icon (falls back to a dot if a name isn't in this build).
const Ic = ({ n, ...p }) => { const C = Lucide[n] || Lucide.Circle; return <C {...p} />; };

// Capacitor Android/iOS WebView: file downloads + window.open are unreliable, so
// exports fall back to an in-app image preview the user can long-press to save.
const isNativeApp = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

const TOOLBAR = [
  { id: 'select', icon: 'MousePointer2', title: 'Select / move' },
  { id: 'pen', icon: 'Pen', title: 'Pen' },
  { id: 'highlighter', icon: 'Highlighter', title: 'Highlighter' },
  { id: 'eraserPixel', icon: 'Eraser', title: 'Eraser (rub out)' },
  { id: 'eraserObject', icon: 'Trash2', title: 'Eraser (whole object)' },
  { id: 'rect', icon: 'Square', title: 'Rectangle' },
  { id: 'rounded', icon: 'Square', title: 'Rounded rectangle' },
  { id: 'ellipse', icon: 'Circle', title: 'Circle / ellipse' },
  { id: 'triangle', icon: 'Triangle', title: 'Triangle' },
  { id: 'diamond', icon: 'Diamond', title: 'Diamond' },
  { id: 'line', icon: 'Minus', title: 'Line' },
  { id: 'arrow', icon: 'ArrowUpRight', title: 'Arrow' },
  { id: 'text', icon: 'Type', title: 'Text' },
  { id: 'sticky', icon: 'StickyNote', title: 'Sticky note' },
  { id: 'image', icon: 'Image', title: 'Image' },
  { id: 'laser', icon: 'Zap', title: 'Laser pointer' },
];

function translatePatch(orig, dx, dy) {
  if (orig.type === 'stroke') return { points: orig.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
  if (orig.type === 'shape') return { x0: orig.x0 + dx, y0: orig.y0 + dy, x1: orig.x1 + dx, y1: orig.y1 + dy };
  return { x: orig.x + dx, y: orig.y + dy };
}
function geomKeys(o) {
  if (o.type === 'stroke') return { points: o.points };
  if (o.type === 'shape') return { x0: o.x0, y0: o.y0, x1: o.x1, y1: o.y1 };
  return { x: o.x, y: o.y };
}

export default function Whiteboard({ socket, pc, roomId, user, otherUser, onClose }) {
  const baseRef = useRef(null);
  const liveRef = useRef(null);
  const wrapRef = useRef(null);
  const fileRef = useRef(null);
  const boardRef = useRef(null);
  const syncRef = useRef(null);
  const drawRef = useRef({});
  const textAreaRef = useRef(null);
  const senderId = user?._id || 'me';

  const tool = useRef('pen');
  const [toolId, setToolId] = useState('pen');
  const color = useRef(DEFAULTS.color);
  const width = useRef(DEFAULTS.width);
  const fill = useRef(DEFAULTS.fill);
  const fontSize = useRef(DEFAULTS.fontSize);
  const eraserSize = useRef(DEFAULTS.eraserSize);
  const stickyColor = useRef(STICKY_COLORS[0]);
  const spaceDown = useRef(false);

  const [ui, setUi] = useState({ color: DEFAULTS.color, width: DEFAULTS.width, fill: DEFAULTS.fill });
  const [pages, setPages] = useState([{ id: 'p0', template: 'blank' }]);
  const [pageIndex, setPageIndexState] = useState(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [selCount, setSelCount] = useState(0);
  const [zoom, setZoom] = useState(1);

  const [chat, setChat] = useState([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [unread, setUnread] = useState(0);
  const [reactions, setReactions] = useState([]);
  const [handRaised, setHandRaised] = useState(false);
  const [peerHand, setPeerHand] = useState(false);
  const [textEditor, setTextEditor] = useState(null); // { cssX, cssY, world, value, id }
  const [rich, setRich] = useState(null);             // { kind:'math'|'code', value }
  const [showPages, setShowPages] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [exportPreview, setExportPreview] = useState(null); // native: long-press to save

  const setTool = (id) => { tool.current = id; setToolId(id); if (id === 'image') fileRef.current?.click(); };

  // ── Board + sync lifecycle ────────────────────────────────────────────────
  useEffect(() => {
    const board = new Board({
      senderId,
      onLocalOp: (op) => syncRef.current?.sendOp(op),
      onChange: () => {
        setPages([...board.pages]);
        setPageIndexState(board.pageIndex);
        setCanUndo(board.canUndo());
        setCanRedo(board.canRedo());
        setSelCount(board.selection.size);
        setZoom(board.viewport.scale);
      },
    });
    boardRef.current = board;
    board.attach(baseRef.current, liveRef.current);

    const sync = new WhiteboardSync({
      socket, pc, roomId, user, board,
      handlers: {
        onChat: (msg) => { setChat((c) => [...c, msg]); if (!chatOpenRef.current) setUnread((u) => u + 1); },
        onReaction: (r) => spawnReaction(r.emoji),
        onRaiseHand: (r) => setPeerHand(!!r.state),
        onPeerLeave: () => setPeerHand(false),
      },
    });
    syncRef.current = sync;
    sync.init();

    const ro = new ResizeObserver(() => board.resize());
    ro.observe(wrapRef.current);

    // Try to hydrate the saved board from the server (survives both leaving).
    (async () => {
      try {
        const { default: api } = await import('../services/api');
        const { data } = await api.get(`/whiteboard/${encodeURIComponent(roomId)}`);
        if (data?.snapshot) board.mergeSnapshot(data.snapshot);
      } catch { /* no saved board yet — fine */ }
    })();

    return () => { ro.disconnect(); sync.destroy(); board.detach(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chatOpenRef = useRef(false);
  useEffect(() => { chatOpenRef.current = chatOpen; if (chatOpen) setUnread(0); }, [chatOpen]);

  // Debounced autosave of the board snapshot to the server.
  useEffect(() => {
    const t = setInterval(async () => {
      const b = boardRef.current; if (!b) return;
      try {
        const { default: api } = await import('../services/api');
        await api.put(`/whiteboard/${encodeURIComponent(roomId)}`, { snapshot: b.snapshot() });
      } catch { /* ignore transient save errors */ }
    }, 12000);
    return () => clearInterval(t);
  }, [roomId]);

  const spawnReaction = (emoji) => {
    const id = Math.random().toString(36).slice(2);
    setReactions((r) => [...r, { id, emoji, left: 10 + Math.random() * 80 }]);
    setTimeout(() => setReactions((r) => r.filter((x) => x.id !== id)), 2600);
  };

  // ── Pointer helpers ───────────────────────────────────────────────────────
  const getWorld = (e) => {
    const rect = liveRef.current.getBoundingClientRect();
    const cssX = e.clientX - rect.left, cssY = e.clientY - rect.top;
    return { cssX, cssY, ...boardRef.current.toWorld(cssX, cssY) };
  };

  useEffect(() => {
    const cv = liveRef.current;
    const board = boardRef.current;
    const sync = syncRef.current;

    const down = (e) => {
      if (e.button === 2) return; // context menu
      cv.setPointerCapture?.(e.pointerId);
      const { cssX, cssY, x, y } = getWorld(e);
      const t = tool.current;
      const kind = TOOLS[t]?.kind;

      if (spaceDown.current || e.button === 1 || t === 'pan') {
        drawRef.current = { mode: 'pan', lastX: cssX, lastY: cssY }; return;
      }

      if (kind === 'draw') {
        const stroke = { id: nextLocalId(senderId), type: 'stroke', tool: t, color: color.current,
          width: t === 'highlighter' ? DEFAULTS.highlighterWidth : width.current, points: [{ x, y }] };
        board.setLocalLive(stroke); drawRef.current = { mode: 'draw', stroke, lastLive: 0 };
      } else if (kind === 'shape') {
        const shape = { id: nextLocalId(senderId), type: 'shape', shape: t, color: color.current,
          fill: fill.current, width: width.current, x0: x, y0: y, x1: x, y1: y };
        board.setLocalLive(shape); drawRef.current = { mode: 'shape', shape };
      } else if (t === 'eraserObject') {
        board.objectEraseAt({ x, y }, 8 / board.viewport.scale); drawRef.current = { mode: 'eraseObj' };
      } else if (t === 'eraserPixel') {
        drawRef.current = { mode: 'pixel', pts: [{ x, y }] };
      } else if (t === 'laser') {
        board.addLaser(x, y, sync.color); sync.sendLaser(x, y); drawRef.current = { mode: 'laser' };
      } else if (t === 'text') {
        // Release the canvas pointer capture so focus can move to the <textarea>
        // — critical on touch, where a captured canvas keeps the soft keyboard
        // from ever opening (the old "the T tool does nothing on mobile" bug).
        cv.releasePointerCapture?.(e.pointerId);
        // Create the text object UP-FRONT (mirrors sticky) so a tap always yields
        // an editable, already-broadcast element; an empty commit deletes it again
        // in commitText. This removes the "empty blur = nothing happened" dead end.
        const o = { id: nextLocalId(senderId), type: 'text', x, y, text: '', color: color.current, size: fontSize.current };
        board.addObject(o); board.setSelection([o.id]);
        setTextEditor({ cssX, cssY, world: { x, y }, value: '', id: o.id });
        setTool('select');
        drawRef.current = {};
      } else if (t === 'sticky') {
        const o = { id: nextLocalId(senderId), type: 'sticky', x, y, w: 160, h: 120, text: '', color: stickyColor.current };
        board.addObject(o); board.setSelection([o.id]);
        setTextEditor({ cssX, cssY, world: { x, y }, value: '', id: o.id, sticky: true });
        setTool('select'); drawRef.current = {};
      } else if (t === 'select') {
        const hit = board.hitObject({ x, y }, 8 / board.viewport.scale);
        // resize handle test on a single existing selection
        const single = board.selection.size === 1 ? board.objects.get([...board.selection][0]) : null;
        const rh = single ? isOnResizeHandle(board, single, cssX, cssY) : false;
        if (rh && single) {
          drawRef.current = { mode: 'resize', id: single.id, orig: { ...single }, start: { x, y }, prev: geomKeys(single) };
        } else if (hit) {
          board.setSelection([hit.id]);
          drawRef.current = { mode: 'move', id: hit.id, orig: { ...hit }, start: { x, y }, prev: geomKeys(hit) };
        } else {
          board.clearSelection(); drawRef.current = { mode: 'marquee', start: { x, y } };
        }
      }
      sync.sendCursor(x, y, t);
    };

    const move = (e) => {
      const { cssX, cssY, x, y } = getWorld(e);
      const d = drawRef.current;
      sync.sendCursor(x, y, tool.current);

      switch (d.mode) {
        case 'pan':
          board.panBy(cssX - d.lastX, cssY - d.lastY); d.lastX = cssX; d.lastY = cssY; break;
        case 'draw': {
          const pts = d.stroke.points;
          if (pts.length < LIMITS.maxPoints) pts.push({ x, y });
          board.markDirty();
          const now = performance.now();
          if (now - d.lastLive > 45) { d.lastLive = now; sync.sendLiveStroke(d.stroke); }
          break;
        }
        case 'shape': {
          const c = constrain(d.shape.shape, d.shape.x0, d.shape.y0, x, y, e.shiftKey);
          Object.assign(d.shape, c); board.markDirty(); sync.sendLiveStroke(d.shape);
          break;
        }
        case 'eraseObj': board.objectEraseAt({ x, y }, 8 / board.viewport.scale); break;
        case 'pixel': d.pts.push({ x, y }); board.markDirty(); break;
        case 'move': case 'resize': {
          if (d.mode === 'move') {
            board.liveUpdate(d.id, translatePatch(d.orig, x - d.start.x, y - d.start.y));
          } else {
            board.liveUpdate(d.id, resizePatch(d.orig, x, y));
          }
          break;
        }
        case 'laser': board.addLaser(x, y, sync.color); sync.sendLaser(x, y); break;
        default: break;
      }
    };

    const up = () => {
      const d = drawRef.current; const board = boardRef.current; const sync = syncRef.current;
      switch (d.mode) {
        case 'draw':
          board.setLocalLive(null); sync.sendLiveStroke(null);
          if (d.stroke.points.length) board.addObject(d.stroke);
          break;
        case 'shape': {
          board.setLocalLive(null); sync.sendLiveStroke(null);
          const w = Math.abs(d.shape.x1 - d.shape.x0), h = Math.abs(d.shape.y1 - d.shape.y0);
          if (w > 3 || h > 3) board.addObject(d.shape);
          break;
        }
        case 'pixel': board.pixelErase(d.pts, eraserSize.current / 2 / board.viewport.scale); break;
        case 'move': case 'resize': {
          const o = board.objects.get(d.id);
          if (o) board.commitUpdate(d.id, geomKeys(o), d.prev);
          break;
        }
        default: break;
      }
      drawRef.current = {};
    };

    const wheel = (e) => {
      e.preventDefault();
      const rect = cv.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) board.zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY < 0 ? 1.1 : 0.9);
      else board.panBy(-e.deltaX, -e.deltaY);
    };
    const dbl = (e) => {
      const { cssX, cssY, x, y } = getWorld(e);
      const hit = board.hitObject({ x, y }, 8 / board.viewport.scale);
      if (hit && (hit.type === 'text' || hit.type === 'sticky')) {
        setTextEditor({ cssX, cssY, world: { x: hit.x, y: hit.y }, value: hit.text || '', id: hit.id, sticky: hit.type === 'sticky' });
      }
    };

    cv.addEventListener('pointerdown', down);
    cv.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    cv.addEventListener('wheel', wheel, { passive: false });
    cv.addEventListener('dblclick', dbl);
    return () => {
      cv.removeEventListener('pointerdown', down);
      cv.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      cv.removeEventListener('wheel', wheel);
      cv.removeEventListener('dblclick', dbl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keyboard: space-pan, undo/redo, delete
  useEffect(() => {
    const kd = (e) => {
      if (e.code === 'Space') spaceDown.current = true;
      const meta = e.ctrlKey || e.metaKey;
      if (meta && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? boardRef.current.redo() : boardRef.current.undo(); }
      if (meta && e.key.toLowerCase() === 'y') { e.preventDefault(); boardRef.current.redo(); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && boardRef.current.selection.size && !textEditor) {
        e.preventDefault(); boardRef.current.deleteObjects([...boardRef.current.selection]);
      }
    };
    const ku = (e) => { if (e.code === 'Space') spaceDown.current = false; };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
    return () => { window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
  }, [textEditor]);

  // paste image
  useEffect(() => {
    const onPaste = (e) => {
      const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
      if (item) placeImageFile(item.getAsFile());
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const placeImageFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => shrinkImage(reader.result, (src, w, h) => {
      const b = boardRef.current;
      const center = b.toWorld(b._css.w / 2, b._css.h / 2);
      b.addObject({ id: nextLocalId(senderId), type: 'image', x: center.x - w / 2, y: center.y - h / 2, w, h, src });
    });
    reader.readAsDataURL(file);
  };

  // ── UI actions ────────────────────────────────────────────────────────────
  const applyColor = (c) => { color.current = c; setUi((u) => ({ ...u, color: c })); if (boardRef.current.selection.size) boardRef.current.selection.forEach((id) => boardRef.current.updateObject(id, { color: c })); };
  // Width/fill mirror applyColor: update the tool default AND any current
  // selection (which broadcasts via updateObject → onLocalOp → sendOp), so a
  // style tweak to an existing shape shows up for the peer, not just future draws.
  const applyWidth = (w) => { width.current = w; setUi((u) => ({ ...u, width: w })); const b = boardRef.current; if (b.selection.size) b.selection.forEach((id) => b.updateObject(id, { width: w })); };
  const applyFill = (f) => { fill.current = f; setUi((u) => ({ ...u, fill: f })); const b = boardRef.current; if (b.selection.size) b.selection.forEach((id) => b.updateObject(id, { fill: f })); };

  const commitText = () => {
    const te = textEditor; if (!te) { return; }
    const b = boardRef.current;
    const val = te.value.trim();
    if (te.id) {
      if (te.sticky || val) b.updateObject(te.id, { text: te.value });
      else b.deleteObjects([te.id]);
    } else if (val) {
      b.addObject({ id: nextLocalId(senderId), type: 'text', x: te.world.x, y: te.world.y, text: te.value, color: color.current, size: fontSize.current });
    }
    setTextEditor(null);
  };

  // Focus the inline text editor imperatively when it OPENS (keyed by object id),
  // rather than relying on autoFocus on an async-mounted textarea. The rAF lets
  // the element mount first; this reliably opens the mobile soft keyboard, which
  // autoFocus alone often fails to do after a pointer gesture. select() when
  // re-editing existing text so typing replaces it.
  useEffect(() => {
    if (!textEditor) return;
    const raf = requestAnimationFrame(() => {
      const el = textAreaRef.current;
      if (!el) return;
      el.focus();
      if (el.value) el.select();
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textEditor?.id]);

  const insertRich = () => {
    const r = rich; if (!r || !r.value.trim()) { setRich(null); return; }
    const b = boardRef.current;
    const { dataURL, w, h } = r.kind === 'math' ? renderMath(r.value) : renderCode(r.value);
    const center = b.toWorld(b._css.w / 2, b._css.h / 2);
    b.addObject({ id: nextLocalId(senderId), type: r.kind, source: r.value, src: dataURL, x: center.x - w / 2, y: center.y - h / 2, w, h });
    setRich(null);
  };

  const exportAs = (kind) => {
    const b = boardRef.current;
    // Android/iOS WebView: downloads + window.open are unreliable — show an
    // in-app preview (long-press the image to save it to the device).
    if (isNativeApp()) { setExportPreview(b.toPNG(2)); setShowMore(false); return; }
    if (kind === 'png') downloadURL(b.toPNG(), `orbit-board-${Date.now()}.png`);
    else if (kind === 'svg') downloadBlob(b.toSVG(), 'image/svg+xml', `orbit-board-${Date.now()}.svg`);
    else if (kind === 'pdf') exportPDF(b.toPNG(2));
    setShowMore(false);
  };

  const sendChat = () => {
    const text = chatInput.trim(); if (!text) return;
    const msg = syncRef.current.sendChat(text);
    setChat((c) => [...c, msg]); setChatInput('');
  };
  const react = (emoji) => { syncRef.current.sendReaction(emoji); spawnReaction(emoji); };
  const toggleHand = () => { const s = !handRaised; setHandRaised(s); syncRef.current.sendRaiseHand(s); };

  const isDraw = ['pen', 'highlighter'].includes(toolId);
  const isShape = SHAPE_TOOLS.includes(toolId);

  return (
    <div className="wb-root" ref={wrapRef}>
      <canvas ref={baseRef} className="wb-canvas wb-base" />
      <canvas ref={liveRef} className="wb-canvas wb-live" style={{ touchAction: 'none', cursor: toolId === 'select' ? 'default' : 'crosshair' }} />

      {/* floating reactions */}
      <div className="wb-reactions-layer">
        {reactions.map((r) => <span key={r.id} className="wb-react-float" style={{ left: `${r.left}%` }}>{r.emoji}</span>)}
      </div>
      {peerHand && <div className="wb-peer-hand">✋ {otherUser?.name || 'Peer'} raised a hand</div>}

      {/* top-left: close + title */}
      <div className="wb-top">
        <button className="wb-icon-btn" title="Close whiteboard" onClick={onClose}><Ic n="X" size={18} /></button>
        <span className="wb-title">Whiteboard</span>
      </div>

      {/* top-right: undo/redo/zoom/pages/export/collab */}
      <div className="wb-top-right">
        <button className="wb-icon-btn" disabled={!canUndo} title="Undo" onClick={() => boardRef.current.undo()}><Ic n="Undo2" size={17} /></button>
        <button className="wb-icon-btn" disabled={!canRedo} title="Redo" onClick={() => boardRef.current.redo()}><Ic n="Redo2" size={17} /></button>
        <span className="wb-sep" />
        <button className="wb-icon-btn" title="Zoom out" onClick={() => boardRef.current.zoomAt(boardRef.current._css.w / 2, boardRef.current._css.h / 2, 0.9)}><Ic n="ZoomOut" size={17} /></button>
        <button className="wb-zoom" title="Reset view" onClick={() => boardRef.current.resetView()}>{Math.round(zoom * 100)}%</button>
        <button className="wb-icon-btn" title="Zoom in" onClick={() => boardRef.current.zoomAt(boardRef.current._css.w / 2, boardRef.current._css.h / 2, 1.1)}><Ic n="ZoomIn" size={17} /></button>
        <span className="wb-sep" />
        <button className="wb-icon-btn" title="Pages" onClick={() => setShowPages((s) => !s)}><Ic n="Layers" size={17} /></button>
        <button className={`wb-icon-btn ${chatOpen ? 'active' : ''}`} title="Chat" onClick={() => setChatOpen((s) => !s)}>
          <Ic n="MessageSquare" size={17} />{unread > 0 && <span className="wb-badge">{unread}</span>}
        </button>
        <button className={`wb-icon-btn ${handRaised ? 'active' : ''}`} title="Raise hand" onClick={toggleHand}><Ic n="Hand" size={17} /></button>
        <div className="wb-more-wrap">
          <button className="wb-icon-btn" title="More" onClick={() => setShowMore((s) => !s)}><Ic n="MoreHorizontal" size={17} /></button>
          {showMore && (
            <div className="wb-menu">
              <button onClick={() => { setRich({ kind: 'math', value: '' }); setShowMore(false); }}><Ic n="Sigma" size={15} /> Insert math</button>
              <button onClick={() => { setRich({ kind: 'code', value: '' }); setShowMore(false); }}><Ic n="Code" size={15} /> Insert code</button>
              <button onClick={() => exportAs('png')}><Ic n="Download" size={15} /> Export PNG</button>
              <button onClick={() => exportAs('svg')}><Ic n="Download" size={15} /> Export SVG</button>
              <button onClick={() => exportAs('pdf')}><Ic n="Download" size={15} /> Export PDF</button>
              <button className="wb-danger" onClick={() => { if (confirm('Clear this page for everyone?')) boardRef.current.clearPage(); setShowMore(false); }}><Ic n="Trash2" size={15} /> Clear page</button>
            </div>
          )}
        </div>
      </div>

      {/* left toolbar */}
      <div className="wb-toolbar">
        {TOOLBAR.map((t) => (
          <button key={t.id} className={`wb-tool ${toolId === t.id ? 'active' : ''}`} title={t.title} onClick={() => setTool(t.id)}>
            <Ic n={t.icon} size={18} />
          </button>
        ))}
      </div>

      {/* bottom style bar */}
      <div className="wb-stylebar">
        <div className="wb-swatches">
          {(toolId === 'sticky' ? STICKY_COLORS : PALETTE).map((c) => (
            <button key={c} className={`wb-swatch ${ui.color === c ? 'sel' : ''}`} style={{ background: c }}
              onClick={() => toolId === 'sticky' ? (stickyColor.current = c) : applyColor(c)} />
          ))}
          <input type="color" className="wb-color-pick" value={ui.color} onChange={(e) => applyColor(e.target.value)} title="Custom color" />
        </div>
        {(isDraw || isShape) && (
          <div className="wb-width">
            <Ic n="Minus" size={14} />
            <input type="range" min="1" max="30" value={ui.width} onChange={(e) => applyWidth(+e.target.value)} />
          </div>
        )}
        {isShape && (
          <button className={`wb-fill ${ui.fill !== 'transparent' ? 'on' : ''}`} title="Toggle fill"
            onClick={() => applyFill(ui.fill === 'transparent' ? ui.color : 'transparent')}>Fill</button>
        )}
        {toolId === 'eraserPixel' && (
          <div className="wb-width"><Ic n="Eraser" size={14} />
            <input type="range" min="8" max="80" defaultValue={eraserSize.current} onChange={(e) => (eraserSize.current = +e.target.value)} /></div>
        )}
        {selCount > 0 && (
          <button className="wb-fill wb-danger" onClick={() => boardRef.current.deleteObjects([...boardRef.current.selection])}>
            <Ic n="Trash2" size={14} /> Delete ({selCount})
          </button>
        )}
      </div>

      {/* reactions quick bar */}
      <div className="wb-react-bar">
        {['👍', '❤️', '😂', '🎉', '👏', '🔥'].map((em) => (
          <button key={em} onClick={() => react(em)}>{em}</button>
        ))}
      </div>

      {/* pages panel */}
      {showPages && (
        <div className="wb-pages">
          <div className="wb-pages-head"><span>Pages</span><button className="wb-icon-btn" onClick={() => setShowPages(false)}><Ic n="X" size={14} /></button></div>
          <div className="wb-pages-list">
            {pages.map((p, i) => (
              <div key={p.id} className={`wb-page ${i === pageIndex ? 'active' : ''}`}>
                <button className="wb-page-btn" onClick={() => boardRef.current.setPage(i)}>Page {i + 1}<em>{p.template}</em></button>
                {pages.length > 1 && <button className="wb-icon-btn sm" title="Delete page" onClick={() => boardRef.current.deletePage(p.id)}><Ic n="Trash2" size={13} /></button>}
              </div>
            ))}
          </div>
          <div className="wb-tpl-row">
            {TEMPLATES.map((tpl) => (
              <button key={tpl} className="wb-tpl" title={`Set ${tpl}`} onClick={() => boardRef.current.setTemplate(tpl)}>{tpl}</button>
            ))}
          </div>
          <button className="wb-addpage" onClick={() => boardRef.current.addPage('blank')}><Ic n="Plus" size={14} /> Add page</button>
        </div>
      )}

      {/* chat */}
      {chatOpen && (
        <div className="wb-chat">
          <div className="wb-chat-head"><span>Chat</span><button className="wb-icon-btn" onClick={() => setChatOpen(false)}><Ic n="X" size={14} /></button></div>
          <div className="wb-chat-body">
            {chat.length === 0 && <p className="wb-chat-empty">No messages yet.</p>}
            {chat.map((m) => (
              <div key={m.id} className={`wb-msg ${m.from === senderId ? 'me' : ''}`}>
                <span className="wb-msg-name">{m.from === senderId ? 'You' : m.name}</span>
                <span className="wb-msg-text">{m.text}</span>
              </div>
            ))}
          </div>
          <div className="wb-chat-input">
            <input value={chatInput} placeholder="Message…" onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendChat()} />
            <button onClick={sendChat}><Ic n="Send" size={16} /></button>
          </div>
        </div>
      )}

      {/* inline text editor */}
      {textEditor && (
        <textarea
          ref={textAreaRef}
          className="wb-text-edit"
          autoFocus
          inputMode="text"
          style={{ left: textEditor.cssX, top: textEditor.cssY, color: textEditor.sticky ? '#1a1a2e' : ui.color, fontSize: (textEditor.sticky ? 15 : fontSize.current) }}
          value={textEditor.value}
          onChange={(e) => setTextEditor((t) => ({ ...t, value: e.target.value }))}
          onBlur={commitText}
          onKeyDown={(e) => {
            // Plain Enter commits; Shift+Enter (or Ctrl/Cmd+Enter) inserts a newline.
            if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) { e.preventDefault(); commitText(); }
            // Escape also commits so a freshly-created empty box is cleaned up
            // (commitText deletes it when empty) instead of orphaning on the board.
            else if (e.key === 'Escape') { e.preventDefault(); commitText(); }
          }}
        />
      )}

      {/* math / code modal */}
      {rich && (
        <div className="wb-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setRich(null)}>
          <div className="wb-modal">
            <h3>{rich.kind === 'math' ? 'Insert math' : 'Insert code'}</h3>
            <p className="wb-modal-hint">{rich.kind === 'math' ? 'Use ^ for superscript, _ for subscript. e.g. E = mc^2' : 'Paste a code snippet — keywords are highlighted.'}</p>
            <textarea autoFocus value={rich.value} onChange={(e) => setRich((r) => ({ ...r, value: e.target.value }))}
              placeholder={rich.kind === 'math' ? 'a^2 + b^2 = c^2' : 'function hello() {\n  return 42;\n}'} rows={rich.kind === 'code' ? 8 : 3} />
            <div className="wb-modal-actions">
              <button onClick={() => setRich(null)}>Cancel</button>
              <button className="wb-primary" onClick={insertRich}>Insert</button>
            </div>
          </div>
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { placeImageFile(e.target.files?.[0]); e.target.value = ''; }} />

      {/* native export preview — long-press the image to save */}
      {exportPreview && (
        <div className="wb-modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setExportPreview(null)}>
          <div className="wb-modal" style={{ textAlign: 'center' }}>
            <h3>Save board</h3>
            <p className="wb-modal-hint">Long-press the image below to save it to your device.</p>
            <img src={exportPreview} alt="Whiteboard export" style={{ maxWidth: '100%', maxHeight: '60vh', borderRadius: 10, border: '1px solid var(--border-subtle)' }} />
            <div className="wb-modal-actions">
              <button className="wb-primary" onClick={() => setExportPreview(null)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── helpers ──────────────────────────────────────────────────────────────
function constrain(shape, x0, y0, x1, y1, shift) { return constrainShape(shape, x0, y0, x1, y1, shift); }

function isOnResizeHandle(board, obj, cssX, cssY) {
  if (obj.type === 'stroke') return false;
  const b = bbox(obj);
  const hx = b.x + b.w, hy = b.y + b.h; // BR corner (world)
  const sx = hx * board.viewport.scale + board.viewport.x;
  const sy = hy * board.viewport.scale + board.viewport.y;
  return Math.hypot(sx - cssX, sy - cssY) <= 12;
}

function resizePatch(orig, x, y) {
  if (orig.type === 'shape') return { x1: x, y1: y };
  return { w: Math.max(24, x - orig.x), h: Math.max(24, y - orig.y) };
}

function downloadURL(url, name) { const a = document.createElement('a'); a.href = url; a.download = name; a.click(); }
function downloadBlob(text, type, name) { const url = URL.createObjectURL(new Blob([text], { type })); downloadURL(url, name); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function shrinkImage(dataURL, cb) {
  const img = new Image();
  img.onload = () => {
    const max = 1200; let { width: w, height: h } = img;
    if (w > max || h > max) { const s = max / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s); }
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    cv.getContext('2d').drawImage(img, 0, 0, w, h);
    let out = cv.toDataURL('image/png');
    if (out.length > LIMITS.maxImageBytes) out = cv.toDataURL('image/jpeg', 0.82);
    cb(out, w, h);
  };
  img.src = dataURL;
}

// Single-page PDF export: open the rendered PNG in a new tab and invoke the
// platform print-to-PDF. Reliable across web + Android WebView, zero deps.
function exportPDF(pngDataURL) {
  const win = window.open('');
  if (!win) return;
  win.document.write(`<html><head><title>Orbit Board</title><style>@page{margin:0}body{margin:0}img{width:100%}</style></head><body><img src="${pngDataURL}" onload="window.focus();window.print()"/></body></html>`);
  win.document.close();
}
