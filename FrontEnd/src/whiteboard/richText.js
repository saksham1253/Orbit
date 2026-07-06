/**
 * Orbit Whiteboard — native math & code rendering (no external libraries).
 * Renders to an offscreen canvas and returns { dataURL, w, h } so the result
 * becomes a normal image-backed board object that syncs and exports like any
 * other. Keeps the "own whiteboard" mandate: zero third-party render deps.
 */

// ── Code block: monospace with line numbers + lightweight token coloring ────
const KEYWORDS = new Set(['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class',
  'import', 'export', 'from', 'new', 'await', 'async', 'try', 'catch', 'def', 'print', 'public', 'private',
  'static', 'void', 'int', 'float', 'string', 'bool', 'true', 'false', 'null', 'None', 'True', 'False', 'this', 'super']);

function colorToken(tok) {
  if (KEYWORDS.has(tok)) return '#c792ea';       // purple keywords
  if (/^["'`].*["'`]$/.test(tok)) return '#c3e88d'; // strings
  if (/^\/\/.*/.test(tok)) return '#616a86';     // comments
  if (/^\d[\d._]*$/.test(tok)) return '#f78c6c'; // numbers
  return '#d6deeb';                               // default
}

export function renderCode(source) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const lines = String(source).replace(/\t/g, '  ').split('\n');
  const fontPx = 15, lh = 22, padX = 14, gutter = 42, padY = 12;
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = `${fontPx}px "Fira Code", Consolas, monospace`;
  let maxW = 0;
  for (const ln of lines) maxW = Math.max(maxW, measure.measureText(ln).width);
  const w = Math.ceil(gutter + padX + maxW + padX);
  const h = Math.ceil(padY * 2 + lines.length * lh);

  const cv = document.createElement('canvas');
  cv.width = w * dpr; cv.height = h * dpr;
  const ctx = cv.getContext('2d');
  ctx.scale(dpr, dpr);
  // panel
  ctx.fillStyle = '#0b0e1f'; roundRectPath(ctx, 0, 0, w, h, 10); ctx.fill();
  ctx.strokeStyle = 'rgba(124,58,237,0.4)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = 'rgba(124,58,237,0.08)'; ctx.fillRect(0, 0, gutter, h);
  ctx.font = `${fontPx}px "Fira Code", Consolas, monospace`;
  ctx.textBaseline = 'top';
  lines.forEach((ln, i) => {
    const y = padY + i * lh;
    ctx.fillStyle = '#4a5578'; ctx.fillText(String(i + 1).padStart(2, ' '), 10, y);
    // tokenize keeping separators
    let x = gutter + padX;
    const parts = ln.match(/(\/\/.*$)|("[^"]*"|'[^']*'|`[^`]*`)|(\w+)|(\s+)|([^\w\s])/g) || [];
    for (const p of parts) {
      ctx.fillStyle = colorToken(p);
      ctx.fillText(p, x, y);
      x += ctx.measureText(p).width;
    }
  });
  return { dataURL: cv.toDataURL('image/png'), w, h };
}

// ── Math: native super/subscript + simple fraction (a/b) stacking ───────────
export function renderMath(source) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const base = 30, pad = 16;
  const measure = document.createElement('canvas').getContext('2d');
  const tokens = tokenizeMath(String(source));
  measure.font = `italic ${base}px "Cambria Math", Georgia, serif`;
  let width = 0;
  for (const t of tokens) {
    measure.font = `italic ${t.size === 'small' ? base * 0.62 : base}px Georgia, serif`;
    width += measure.measureText(t.text).width + 2;
  }
  const w = Math.ceil(width + pad * 2);
  const h = Math.ceil(base * 2 + pad);

  const cv = document.createElement('canvas');
  cv.width = w * dpr; cv.height = h * dpr;
  const ctx = cv.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.fillStyle = 'rgba(0,198,255,0.06)'; roundRectPath(ctx, 0, 0, w, h, 10); ctx.fill();
  ctx.strokeStyle = 'rgba(0,198,255,0.35)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.textBaseline = 'alphabetic';
  const midY = h / 2 + base / 3;
  let x = pad;
  for (const t of tokens) {
    const size = t.size === 'small' ? base * 0.62 : base;
    ctx.font = `italic ${size}px Georgia, serif`;
    ctx.fillStyle = '#eaf6ff';
    const dy = t.sup ? -base * 0.4 : t.sub ? base * 0.35 : 0;
    ctx.fillText(t.text, x, midY + dy);
    x += ctx.measureText(t.text).width + 2;
  }
  return { dataURL: cv.toDataURL('image/png'), w, h };
}

function tokenizeMath(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '^' || c === '_') {
      i++;
      let grp = '';
      if (src[i] === '{') { i++; while (i < src.length && src[i] !== '}') grp += src[i++]; i++; }
      else { grp = src[i] || ''; i++; }
      out.push({ text: grp, size: 'small', sup: c === '^', sub: c === '_' });
    } else {
      out.push({ text: c, size: 'normal' });
      i++;
    }
  }
  return out;
}

function roundRectPath(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
