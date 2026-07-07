/**
 * DraggableVideoTile — a movable/resizable in-call video PiP (self or remote).
 *
 * Pointer Events (mouse + touch, via setPointerCapture — same model as the
 * whiteboard canvas) give: drag anywhere within the stage, snap to the nearest
 * corner on release, corner-handle resize (works on touch too), double-tap/click
 * to toggle compact/large, and a collapse-to-bubble button. Position + size +
 * collapsed persist per tile in callLayoutStore, so a tuned layout survives
 * reloads. Bounds are clamped to the parent stage every move, so a tile can
 * always be dragged clear of the controls and can never strand itself off-screen.
 *
 * The parent passes the <video> (and any overlay) as children; this component
 * owns only the frame + gestures.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Minus, Maximize2 } from 'lucide-react';
import useCallLayoutStore from '../store/callLayoutStore';

const PAD = 12;              // gap from stage edge when snapped
const MIN_W = 96, MIN_H = 72;
const MAX_W = 420, MAX_H = 320;
const BUBBLE = 52;           // collapsed size
const DOUBLE_MS = 300;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export default function DraggableVideoTile({
  tileId,                    // 'self' | 'remote'
  defaultCorner = 'br',      // 'tl' | 'tr' | 'bl' | 'br'
  defaultSize = { w: 160, h: 120 },
  zBase = 30,
  label = 'Video',
  children,
}) {
  const saved = useCallLayoutStore((s) => s[tileId]);
  const setTile = useCallLayoutStore((s) => s.setTile);

  const elRef = useRef(null);
  const dragRef = useRef(null);       // active gesture: { mode, pointerId, ... }
  const lastTapRef = useRef(0);
  const [box, setBox] = useState(null); // { x, y, w, h } in stage px
  const [collapsed, setCollapsed] = useState(!!saved?.collapsed);
  const [dragging, setDragging] = useState(false);

  const parent = () => elRef.current?.offsetParent || elRef.current?.parentElement;

  // Compute the default corner position for a given stage + size.
  const cornerPos = useCallback((W, H, w, h, corner) => {
    const right = corner.includes('r');
    const bottom = corner.includes('b');
    return {
      x: right ? Math.max(PAD, W - w - PAD) : PAD,
      y: bottom ? Math.max(PAD, H - h - PAD) : PAD,
    };
  }, []);

  // Initialise (and re-clamp on stage resize / rotation).
  useLayoutEffect(() => {
    const p = parent();
    if (!p) return;
    const W = p.clientWidth, H = p.clientHeight;
    const w = clamp(saved?.w || defaultSize.w, MIN_W, MAX_W);
    const h = clamp(saved?.h || defaultSize.h, MIN_H, MAX_H);
    let x, y;
    if (saved && typeof saved.x === 'number') {
      x = clamp(saved.x, PAD, Math.max(PAD, W - w - PAD));
      y = clamp(saved.y, PAD, Math.max(PAD, H - h - PAD));
    } else {
      ({ x, y } = cornerPos(W, H, w, h, defaultCorner));
    }
    setBox({ x, y, w, h });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the tile inside the stage when the window/stage resizes or rotates.
  useEffect(() => {
    const onResize = () => {
      const p = parent();
      if (!p) return;
      setBox((b) => {
        if (!b) return b;
        const W = p.clientWidth, H = p.clientHeight;
        return { ...b, x: clamp(b.x, PAD, Math.max(PAD, W - b.w - PAD)), y: clamp(b.y, PAD, Math.max(PAD, H - b.h - PAD)) };
      });
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => { window.removeEventListener('resize', onResize); window.removeEventListener('orientationchange', onResize); };
  }, []);

  const persist = useCallback((b, extra = {}) => {
    setTile(tileId, { x: b.x, y: b.y, w: b.w, h: b.h, ...extra });
  }, [setTile, tileId]);

  const snapCorner = useCallback((b) => {
    const p = parent();
    if (!p) return b;
    const W = p.clientWidth, H = p.clientHeight;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const corner = `${cy < H / 2 ? 't' : 'b'}${cx < W / 2 ? 'l' : 'r'}`;
    const pos = cornerPos(W, H, b.w, b.h, corner);
    return { ...b, ...pos };
  }, [cornerPos]);

  // ── unified pointer handlers (drag + resize) ──
  const onPointerDown = (e, mode) => {
    if (e.button === 2) return;
    e.stopPropagation();
    const p = parent();
    if (!p || !box) return;
    // Double-tap/click toggles compact <-> large (only on the body, not the handle).
    if (mode === 'drag') {
      const now = e.timeStamp; // pointer events always carry a timeStamp
      if (now - lastTapRef.current < DOUBLE_MS) { toggleCompact(); lastTapRef.current = 0; return; }
      lastTapRef.current = now;
    }
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = { mode, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, orig: { ...box } };
    setDragging(true);
  };

  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    const p = parent();
    if (!p) return;
    const W = p.clientWidth, H = p.clientHeight;
    const dx = e.clientX - d.startX, dy = e.clientY - d.startY;
    if (d.mode === 'drag') {
      setBox((b) => ({ ...b, x: clamp(d.orig.x + dx, PAD, Math.max(PAD, W - b.w - PAD)), y: clamp(d.orig.y + dy, PAD, Math.max(PAD, H - b.h - PAD)) }));
    } else {
      // resize from the bottom-left handle: width shrinks/grows with -dx, height with +dy
      setBox((b) => {
        const w = clamp(d.orig.w - dx, MIN_W, Math.min(MAX_W, d.orig.x + d.orig.w - PAD));
        const h = clamp(d.orig.h + dy, MIN_H, Math.min(MAX_H, H - d.orig.y - PAD));
        const x = d.orig.x + (d.orig.w - w); // keep the right edge anchored
        return { ...b, x, w, h };
      });
    }
  };

  const onPointerUp = (e) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    setBox((b) => {
      const snapped = d.mode === 'drag' ? snapCorner(b) : b;
      persist(snapped);
      return snapped;
    });
  };

  const toggleCompact = () => {
    setBox((b) => {
      if (!b) return b;
      const large = b.w >= (defaultSize.w + defaultSize.w * 0.4) - 1;
      const factor = large ? 1 : 1.5;
      const w = clamp(Math.round(defaultSize.w * factor), MIN_W, MAX_W);
      const h = clamp(Math.round(defaultSize.h * factor), MIN_H, MAX_H);
      const next = snapCorner({ ...b, w, h });
      persist(next);
      return next;
    });
  };

  const toggleCollapse = (e) => {
    e.stopPropagation();
    setCollapsed((c) => {
      const nc = !c;
      setTile(tileId, { collapsed: nc });
      return nc;
    });
  };

  if (!box) {
    // First paint before layout measured — render hidden anchor so offsetParent exists.
    return <div ref={elRef} style={{ position: 'absolute', width: 0, height: 0 }} />;
  }

  const w = collapsed ? BUBBLE : box.w;
  const h = collapsed ? BUBBLE : box.h;

  return (
    <div
      ref={elRef}
      onPointerDown={(e) => onPointerDown(e, 'drag')}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        position: 'absolute',
        left: box.x, top: box.y, width: w, height: h,
        borderRadius: collapsed ? '50%' : 12,
        overflow: 'hidden',
        border: '2px solid rgba(255,255,255,0.25)',
        boxShadow: dragging ? '0 12px 40px rgba(0,0,0,0.7)' : '0 8px 32px rgba(0,0,0,0.6)',
        background: '#111',
        zIndex: dragging ? zBase + 20 : zBase,
        cursor: dragging ? 'grabbing' : 'grab',
        touchAction: 'none',
        transition: dragging ? 'none' : 'width .18s ease, height .18s ease, border-radius .18s ease',
        userSelect: 'none',
      }}
      aria-label={`${label} tile — drag to move, double-tap to resize`}
    >
      {children}

      {/* collapse / expand toggle (top-right of the tile) */}
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={toggleCollapse}
        title={collapsed ? `Expand ${label}` : `Minimize ${label}`}
        aria-label={collapsed ? `Expand ${label}` : `Minimize ${label}`}
        style={{
          position: 'absolute', top: 3, right: 3, width: 22, height: 22, borderRadius: 7,
          display: 'grid', placeItems: 'center', border: 'none', cursor: 'pointer',
          background: 'rgba(0,0,0,0.5)', color: '#fff', zIndex: 2,
        }}
      >
        {collapsed ? <Maximize2 size={12} /> : <Minus size={13} />}
      </button>

      {/* resize handle (bottom-left) — hidden while collapsed */}
      {!collapsed && (
        <div
          onPointerDown={(e) => onPointerDown(e, 'resize')}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          title={`Resize ${label}`}
          style={{
            position: 'absolute', left: 0, bottom: 0, width: 22, height: 22,
            cursor: 'nesw-resize', zIndex: 2,
            background: 'linear-gradient(45deg, rgba(255,255,255,0.35) 0 30%, transparent 30%)',
            touchAction: 'none',
          }}
        />
      )}
    </div>
  );
}
