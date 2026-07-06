/**
 * Orbit Whiteboard — object geometry, rendering, and hit-testing.
 * All coordinates are in WORLD space; the caller applies the viewport transform
 * to the canvas context before invoking drawObject().
 */

// ── Freehand smoothing (Catmull-Rom → smooth path) ─────────────────────────
// Produces a fluid stroke from sparse sample points without external libs.
export function strokePath(points) {
  const p = points;
  const path = new Path2D();
  if (!p.length) return path;
  if (p.length < 3) {
    path.moveTo(p[0].x, p[0].y);
    for (let i = 1; i < p.length; i++) path.lineTo(p[i].x, p[i].y);
    return path;
  }
  path.moveTo(p[0].x, p[0].y);
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i === 0 ? 0 : i - 1];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[i + 2 < p.length ? i + 2 : i + 1];
    // Catmull-Rom → Bezier control points
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    path.bezierCurveTo(c1x, c1y, c2x, c2y, p2.x, p2.y);
  }
  return path;
}

// ── Bounding boxes ─────────────────────────────────────────────────────────
export function bbox(obj) {
  switch (obj.type) {
    case 'stroke': {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const pt of obj.points) {
        if (pt.x < minX) minX = pt.x; if (pt.y < minY) minY = pt.y;
        if (pt.x > maxX) maxX = pt.x; if (pt.y > maxY) maxY = pt.y;
      }
      const pad = (obj.width || 3) / 2 + 2;
      return { x: minX - pad, y: minY - pad, w: (maxX - minX) + pad * 2, h: (maxY - minY) + pad * 2 };
    }
    case 'shape': {
      const x = Math.min(obj.x0, obj.x1), y = Math.min(obj.y0, obj.y1);
      const w = Math.abs(obj.x1 - obj.x0), h = Math.abs(obj.y1 - obj.y0);
      const pad = (obj.width || 3) / 2 + 2;
      return { x: x - pad, y: y - pad, w: w + pad * 2, h: h + pad * 2 };
    }
    case 'text':
      return { x: obj.x, y: obj.y, w: obj.w || 200, h: obj.h || (obj.size || 22) * 1.4 };
    case 'sticky':
    case 'image':
    case 'math':
    case 'code':
      return { x: obj.x, y: obj.y, w: obj.w, h: obj.h };
    default:
      return { x: 0, y: 0, w: 0, h: 0 };
  }
}

// ── Rendering ──────────────────────────────────────────────────────────────
export function drawObject(ctx, obj, images) {
  ctx.save();
  switch (obj.type) {
    case 'stroke': drawStroke(ctx, obj); break;
    case 'shape':  drawShape(ctx, obj);  break;
    case 'text':   drawText(ctx, obj);   break;
    case 'sticky': drawSticky(ctx, obj); break;
    case 'image':
    case 'math':
    case 'code':   drawImage(ctx, obj, images); break;
    default: break;
  }
  ctx.restore();
}

function drawStroke(ctx, obj) {
  ctx.strokeStyle = obj.color;
  ctx.lineWidth = obj.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (obj.tool === 'highlighter') {
    ctx.globalAlpha = 0.35;
    ctx.globalCompositeOperation = 'multiply';
  }
  ctx.stroke(strokePath(obj.points));
}

function shapeGeom(obj) {
  const x = Math.min(obj.x0, obj.x1), y = Math.min(obj.y0, obj.y1);
  const w = Math.abs(obj.x1 - obj.x0), h = Math.abs(obj.y1 - obj.y0);
  return { x, y, w, h };
}

function drawShape(ctx, obj) {
  ctx.strokeStyle = obj.color;
  ctx.lineWidth = obj.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const hasFill = obj.fill && obj.fill !== 'transparent';
  if (hasFill) ctx.fillStyle = obj.fill;
  const { x, y, w, h } = shapeGeom(obj);
  const path = new Path2D();

  switch (obj.shape) {
    case 'rect':
      path.rect(x, y, w, h); break;
    case 'rounded': {
      const r = Math.min(20, w / 2, h / 2);
      path.moveTo(x + r, y);
      path.arcTo(x + w, y, x + w, y + h, r);
      path.arcTo(x + w, y + h, x, y + h, r);
      path.arcTo(x, y + h, x, y, r);
      path.arcTo(x, y, x + w, y, r);
      path.closePath();
      break;
    }
    case 'ellipse':
      path.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); break;
    case 'triangle':
      path.moveTo(x + w / 2, y); path.lineTo(x + w, y + h); path.lineTo(x, y + h); path.closePath(); break;
    case 'diamond':
      path.moveTo(x + w / 2, y); path.lineTo(x + w, y + h / 2);
      path.lineTo(x + w / 2, y + h); path.lineTo(x, y + h / 2); path.closePath(); break;
    case 'line':
    case 'arrow':
      path.moveTo(obj.x0, obj.y0); path.lineTo(obj.x1, obj.y1); break;
    default: break;
  }

  if (hasFill && obj.shape !== 'line' && obj.shape !== 'arrow') ctx.fill(path);
  ctx.stroke(path);

  if (obj.shape === 'arrow') {
    const ang = Math.atan2(obj.y1 - obj.y0, obj.x1 - obj.x0);
    const head = Math.max(12, obj.width * 4);
    const a1 = ang + Math.PI - 0.4, a2 = ang + Math.PI + 0.4;
    const ah = new Path2D();
    ah.moveTo(obj.x1, obj.y1);
    ah.lineTo(obj.x1 + head * Math.cos(a1), obj.y1 + head * Math.sin(a1));
    ah.moveTo(obj.x1, obj.y1);
    ah.lineTo(obj.x1 + head * Math.cos(a2), obj.y1 + head * Math.sin(a2));
    ctx.stroke(ah);
  }
}

function drawText(ctx, obj) {
  ctx.fillStyle = obj.color;
  ctx.font = `${obj.size}px "Open Sans", system-ui, sans-serif`;
  ctx.textBaseline = 'top';
  const lines = String(obj.text || '').split('\n');
  lines.forEach((ln, i) => ctx.fillText(ln, obj.x, obj.y + i * obj.size * 1.3));
}

function drawSticky(ctx, obj) {
  // Note card with a soft shadow.
  ctx.fillStyle = obj.color;
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 12; ctx.shadowOffsetY = 4;
  roundRect(ctx, obj.x, obj.y, obj.w, obj.h, 8); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.fillStyle = '#1a1a2e';
  ctx.font = '15px "Open Sans", system-ui, sans-serif';
  ctx.textBaseline = 'top';
  wrapText(ctx, String(obj.text || ''), obj.x + 12, obj.y + 12, obj.w - 24, 20);
}

function drawImage(ctx, obj, images) {
  const img = images.get(obj.id);
  if (img && img.complete && img.naturalWidth) {
    ctx.drawImage(img, obj.x, obj.y, obj.w, obj.h);
  } else {
    // Placeholder while the image element loads.
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    roundRect(ctx, obj.x, obj.y, obj.w, obj.h, 8); ctx.fill();
  }
}

// ── Small canvas helpers ───────────────────────────────────────────────────
export function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function wrapText(ctx, text, x, y, maxW, lineH) {
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(' ')) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, y); line = word; y += lineH;
      } else { line = test; }
    }
    ctx.fillText(line, x, y); y += lineH;
  }
}

// ── Hit-testing (world point → object) ─────────────────────────────────────
export function hitTest(obj, pt, tol = 8) {
  switch (obj.type) {
    case 'stroke': {
      for (let i = 0; i < obj.points.length - 1; i++) {
        if (distToSeg(pt, obj.points[i], obj.points[i + 1]) <= tol + obj.width / 2) return true;
      }
      // single-dot stroke
      if (obj.points.length === 1) return dist(pt, obj.points[0]) <= tol + obj.width / 2;
      return false;
    }
    case 'shape': {
      if (obj.shape === 'line' || obj.shape === 'arrow') {
        return distToSeg(pt, { x: obj.x0, y: obj.y0 }, { x: obj.x1, y: obj.y1 }) <= tol + obj.width / 2;
      }
      const b = shapeGeom(obj);
      const inside = pt.x >= b.x - tol && pt.x <= b.x + b.w + tol && pt.y >= b.y - tol && pt.y <= b.y + b.h + tol;
      if (obj.fill && obj.fill !== 'transparent') return inside;
      // outline-only: hit near the border band
      const inner = pt.x >= b.x + tol && pt.x <= b.x + b.w - tol && pt.y >= b.y + tol && pt.y <= b.y + b.h - tol;
      return inside && !inner;
    }
    default: {
      const b = bbox(obj);
      return pt.x >= b.x && pt.x <= b.x + b.w && pt.y >= b.y && pt.y <= b.y + b.h;
    }
  }
}

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function distToSeg(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return dist(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return dist(p, { x: a.x + t * dx, y: a.y + t * dy });
}

/** Normalize a drag into shape coords, honoring Shift-constrain. */
export function constrainShape(shape, x0, y0, x1, y1, shift) {
  if (!shift) return { x0, y0, x1, y1 };
  if (shape === 'line' || shape === 'arrow') {
    // Snap to nearest 45°.
    const ang = Math.atan2(y1 - y0, x1 - x0);
    const snap = Math.round(ang / (Math.PI / 4)) * (Math.PI / 4);
    const len = Math.hypot(x1 - x0, y1 - y0);
    return { x0, y0, x1: x0 + len * Math.cos(snap), y1: y0 + len * Math.sin(snap) };
  }
  // Square / circle: equalize magnitude.
  const s = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  return { x0, y0, x1: x0 + Math.sign(x1 - x0 || 1) * s, y1: y0 + Math.sign(y1 - y0 || 1) * s };
}
